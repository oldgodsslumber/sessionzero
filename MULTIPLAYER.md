# Daring Comics — Shared Universes

Multiplayer here shares a **universe**, not a character. A universe is the world:
its NPC roster and its wiki. Your heroes and save files stay on your own device.
Everyone at the table binds to the same universe and sees the same world.

| File            | What it is                                                        |
| --------------- | ----------------------------------------------------------------- |
| `index.html`    | The whole app. Works offline with no setup and no network calls.   |
| `core/mp.js`    | Firebase Auth + Realtime Database wrapper, exposed as `MP.*`.      |
| `core/app-mp.js` | The overlay: lobby, sync, GM gating. Wraps the app, never forks it.|

Nothing loads until someone presses **🌐 Play With Your Table** in the universe
manager. Until then the Firebase SDK is never fetched.

---

## 1. Firebase setup

`firebase-config.js` is **not** committed in the shell (it is git-ignored). Copy
`firebase-config.example.js` over it and fill in your own project's values.

**One Firebase project serves every game.** The config is fetched lazily by
`_loadScript('firebase-config.js')` the first time someone opens the lobby, so a
single file at the repo root is picked up by every entry file — you do not add
anything to a new game's `.html`. One project is the right shape here because all
the games are served from one origin, so the API-key referrer allowlist and the
Auth authorized-domains list are one list either way, and because these security
rules are the only thing keeping GM secrets off players' machines: duplicating
them per project multiplies the chance of getting one of them wrong.

Worlds are kept apart by the `systemId` stamped in their `meta` (see §2a), not by
living in separate databases.

Either way:

1. **Realtime Database → Create Database**, then paste the rules in §2. Do not
   leave it in test mode.
2. **Confirm `databaseURL`.** For project `daringcomics-98cea` a `us-central1`
   instance would be:

   ```
   https://daringcomics-98cea-default-rtdb.firebaseio.com
   ```

   Any other region gets a different domain — e.g.
   `…-default-rtdb.europe-west1.firebasedatabase.app`. Copy the exact URL from
   the top of the Realtime Database page. If it is wrong, the lobby shows a
   "Can't reach the database" panel after a few seconds rather than failing
   silently.
3. **Authentication → Sign-in method →** enable **Google**.
4. **Authentication → Settings → Authorised domains:** add wherever you host it
   (`localhost` for local testing, plus your GitHub Pages domain).

5. **Restrict the key** — see the note below. Do this before the config reaches
   any public host.

### Setting up a different project instead

Register a web app under **Project settings → Your apps → Web (`</>`)**, copy the
`firebaseConfig`, and paste it into your `firebase-config.js`. The `databaseURL`
field is not in the snippet Firebase shows you until the Realtime Database
exists — add it by hand from the database page.

### Why the config is committed

`firebase-config.js` is in the repo. It was briefly gitignored, which only
succeeded in breaking the deployed copy: GitHub Pages served an `index.html`
that asked for a file that was never pushed, so **🌐 Play With Your Table**
reported "not set up yet" on the live site while working fine on localhost.

There is no server here to hide a config behind. A static app has to ship these
values to every visitor's browser or it cannot reach the database at all, so
withholding them from the repo protects nothing that a devtools Network tab
would not hand over anyway. **Secrecy is not the control; restriction is.**

That said, the caution behind the original decision was not wrong, and it is
what makes committing this safe rather than sloppy:

- The key is an **`AIzaSy…` Google API key, not a Firebase-only credential.**
  Unrestricted, it can call *any* API enabled on the project. This app talks to
  Gemini, so enabling the Generative Language API on the same project would turn
  a public key into someone else's billable quota.
- Secret scanners flag the pattern regardless of intent, so expect an alert on
  push. It is noise here, but treat it as a prompt to re-check the restrictions
  below rather than something to dismiss.

**The restrictions are not optional.** Before this config reaches any public
host, in the Google Cloud console:

1. **APIs & Services → Credentials** → your browser key.
2. **Application restrictions:** HTTP referrers, listing only your own domains
   (`oldgodsslumber.github.io/*` and `localhost` for local testing).
3. **API restrictions:** only the APIs this app uses (Identity Toolkit for
   Google sign-in, Firebase Realtime Database). Do **not** leave it
   unrestricted, and do not add the Generative Language API to this key.
4. Consider **App Check** to stop unenrolled clients using the project at all.

Together with the rules in §2 — which are the thing actually protecting your
data — a restricted, committed key is genuinely low-risk. An *unrestricted* one
is not, whether it is committed or not.

If a key has been public while unrestricted, rotate it. Rewriting git history
does not help — it was fetchable, and scanners have already read it.

Google sign-in needs a real origin — opening `index.html` from `file://` will not
work for multiplayer. The offline app is unaffected.

---

## 2. Security rules

Paste these into **Realtime Database → Rules**. They are not optional decoration:
`loreGM` is the only thing keeping your hidden entries and secrets off your
players' machines.

> **Read the note under the block before editing it.** Realtime Database rules
> **cascade**: a `.read` granted at a node grants it to every descendant, and no
> deeper rule can take it back. That is why there is deliberately **no `.read`
> at the `$code` level** here — if you add one, `loreGM` becomes readable by
> every player and the GM boundary silently disappears.

```jsonc
{
  "rules": {
    "universes": {
      "$code": {
        // NOTE: no ".read" here, on purpose. Read is granted per subtree below
        // so that loreGM can be withheld. Adding a ".read" at this level would
        // override every restriction underneath it.
        //
        // ".write" here covers exactly two whole-node operations: creating the
        // universe (it does not exist yet) and the GM deleting it. Players get
        // their write access from the per-subtree rules instead.
        ".write": "auth != null && (!data.exists() || data.child('meta/gmUid').val() === auth.uid)",

        "meta": {
          // Readable before you are a member — the join flow has to read it to
          // find the world. Writable by the GM, or by anyone when it does
          // not exist yet, which is how a world gets created.
          ".read":  "auth != null",
          ".write": "auth != null && (!data.exists() || data.child('gmUid').val() === auth.uid)",

          // Which game this world belongs to ('daring-comics',
          // 'dungeon-crawler-carl', ...). Write-once: the client refuses a
          // cross-game join, and this stops a GM changing the stamp underneath a
          // table that has already joined. Worlds created before this field
          // existed have no stamp and stay joinable by anyone.
          "systemId": {
            ".validate": "!data.exists() || data.val() === newData.val()"
          }
        },

        "members": {
          ".read": "auth != null && data.child(auth.uid).exists()",
          "$uid": {
            // You may always write your OWN member row. Without this, joining
            // is impossible: every other rule requires you to already be a
            // member before you can become one.
            ".write": "auth != null && (auth.uid === $uid || data.parent().parent().child('meta/gmUid').val() === auth.uid)"
          }
        },

        "heroes": {
          ".read": "auth != null && data.parent().child('members').child(auth.uid).exists()",
          "$uid": {
            // The world is collaborative; your character sheet is not.
            ".write": "auth != null && (auth.uid === $uid || data.parent().parent().child('meta/gmUid').val() === auth.uid)"
          }
        },

        // ---- collaborative world content: any member reads and writes ----
        "roster":   { ".read": "auth != null && data.parent().child('members').child(auth.uid).exists()",
                      ".write": "auth != null && data.parent().child('members').child(auth.uid).exists()" },
        "lore":     { ".read": "auth != null && data.parent().child('members').child(auth.uid).exists()",
                      ".write": "auth != null && data.parent().child('members').child(auth.uid).exists()" },
        "conflict": { ".read": "auth != null && data.parent().child('members').child(auth.uid).exists()",
                      ".write": "auth != null && data.parent().child('members').child(auth.uid).exists()" },
        "regions":  { ".read": "auth != null && data.parent().child('members').child(auth.uid).exists()",
                      ".write": "auth != null && data.parent().child('members').child(auth.uid).exists()" },
        "rolls":    { ".read": "auth != null && data.parent().child('members').child(auth.uid).exists()",
                      ".write": "auth != null && data.parent().child('members').child(auth.uid).exists()" },
        "notes":    { ".read": "auth != null && data.parent().child('members').child(auth.uid).exists()",
                      ".write": "auth != null && data.parent().child('members').child(auth.uid).exists()" },

        "loreGM": {
          // ── THE GM BOUNDARY ──
          // Wiki entries flagged hidden, and the `secret` field of otherwise
          // public entries, live here and ONLY here. Players cannot read this
          // subtree, so their client never receives the bytes. If you relax
          // this rule — or grant .read at the $code level above — "hidden"
          // becomes a lie any player can see through with devtools or a
          // REST call.
          ".read":  "auth != null && data.parent().child('meta/gmUid').val() === auth.uid",
          ".write": "auth != null && data.parent().child('meta/gmUid').val() === auth.uid"
        }
      }
    },
    "codes": { ".read": "auth != null", "$code": { ".write": "auth != null" } },
    "users": { "$uid": { ".read":  "auth != null && auth.uid === $uid",
                          ".write": "auth != null && auth.uid === $uid" } }
  }
}
```

After pasting, verify the boundary with the **Rules Playground** in the Firebase
console: simulate an authenticated read of
`/universes/{yourcode}/loreGM` as a player's uid. It must be **denied**. If it is
allowed, something granted read higher up the tree.

---

## 2a. Why worlds carry a `systemId`

A join code is four digits and carries no information about which game made it.
Without a stamp, a Dungeon Crawler Carl client could join a Daring Comics world,
mirror a crawler into its roster and inherit a comic wiki — corrupting both sides
with no error anywhere.

So `meta.systemId` records the pack that created the world, and `MP.joinUniverse`
refuses a mismatch with a message naming the owning game. Two deliberate details:

- **The stamp is applied inside `MP`, not at the call site.** `createUniverse`
  defaults it from the active pack, so there is no way to create an unstamped
  world by forgetting an argument, and `joinUniverse` runs the check by default.
- **An absent stamp is treated as compatible.** Worlds created before the field
  existed have no `systemId`, and locking those tables out of their own game
  would be a worse failure than the one being prevented.

Pack-specific world settings live under `meta.packMeta` rather than as loose
fields. Daring Comics puts its tone and power level there; a pack with no such
settings writes nothing, and the shared `meta` shape stays the same for every game.

## 3. Data model

```
universes/{code}/
  meta       { gmUid, gmName, name, systemId, packMeta, createdAt }   // §2a
  members/{uid}  { name, photoURL, heroId, joinedAt }
  heroes/{uid}   each player's character sheet — owner-writable
  roster/{id}    NPCs & villains, plus mirrors of everyone's heroes
  lore/{id}      PUBLIC wiki entries
  loreGM/{id}    hidden entries + secrets — GM read AND write only
  conflict       { data }        shared conflict tracker
  regions        { data, active } shared map
  rolls/{push}   shared dice feed (client shows the last 20)
  notes/{push}   shared session log
codes/{NNNN}   → uid of whoever claimed the code
users/{uid}/universes/{code} → { name, role, joinedAt }
```

---

## 4. How it fits the offline app

A joined universe is mirrored as an ordinary **local** universe object carrying a
`remoteCode`. Everything downstream — `currentUniverse()`, `listLore()`, the
`S.npcs` alias set up by `bindUniverse()` — keeps working unchanged; the overlay
only moves bytes in and out of that object and re-renders.

Local writes funnel through two wrapped functions:

- `saveUniverses()` → pushes roster and wiki (debounced 350 ms, and only the
  entries whose JSON actually changed, so a keystroke in the NPC builder pushes
  one villain rather than the whole roster).
- `save()` → pushes your hero, the conflict tracker and the map.

An `_applyingRemote` flag suppresses pushes while a remote snapshot is being
applied. Without it the two clients ping-pong forever.

---

## 5. Collaboration and safety

Every player can edit the shared world — roster, wiki, map, conflict tracker.
Two things soften that:

- **Attribution.** Every shared write is stamped with `updatedBy` /
  `updatedByName`.
- **Soft delete.** Deleting shared content writes a tombstone rather than
  removing it. **Recently deleted** in the Wiki tab restores anything.

Heroes are the exception: only you (or the GM) can write your character sheet.

---

## 6. Verification checklist

### Offline regression
- [ ] Open `index.html` with an empty `FIREBASE_CONFIG` — everything works, no
      network requests to Firebase, and the multiplayer button explains setup.

### Sign-in and create
- [ ] Universe manager → **Play With Your Table** → **Sign in with Google**.
- [ ] Create a universe — the top bar shows a 4-digit code and a **GM** badge.
- [ ] Firebase console: `universes/{CODE}/meta.gmUid` matches your auth uid.

### Two-browser join
- [ ] In a private window, sign in as a second user and join with the code.
- [ ] The GM's **At the table** chip row shows both players within ~1 s.
- [ ] Each player's hero appears in the other's NPC roster as a hero mirror.

### The GM boundary (the important one)
- [ ] As GM, create a wiki entry with **Hide the whole entry** ticked.
- [ ] As the player, confirm it is absent from the Wiki — then open devtools and
      confirm it is absent from memory too (`JSON.stringify(listLore())`).
- [ ] In the Firebase console, confirm it lives under `loreGM/` and not `lore/`.
- [ ] As GM, add a **Secret** to a public entry. The player sees the entry's
      body but never the secret.
- [ ] As GM, press **Reveal to the table** — the player now sees it.

### Collaboration
- [ ] Either player edits a villain; the change reaches the other within ~1 s
      and the roster card shows who last touched it.
- [ ] Delete a villain, then restore it from **Recently deleted**.

### Table state
- [ ] Rolls from both players appear in **Table Rolls** on the Dice screen.
- [ ] The GM advances the conflict round; players see it.
- [ ] A note added by one player appears for the other, stamped with their name.

### Teardown
- [ ] A player leaves — their local copy of the world remains.
- [ ] The GM deletes the universe — active players are told and returned to the
      lobby, and the 4-digit code is released.

---

## 7. Known limits

- **Last write wins.** Two people editing the same villain in the same second:
  one edit is lost. There is no operational-transform merge.
- **Codes are 4 digits.** 10,000 live universes maximum, and codes are only
  released when the GM deletes the universe.
- **The AI wiki intake is per-device.** Each player uses their own API key from
  AI Setup; entries it files are shared like any other.
- **No presence.** The member list shows who has ever joined, not who is online.
