---
pattern: "Verify in the environment the user is in, not a convenient proxy — a redirected pipe and a TTY are different code paths, and a long-running command must write its banner to /dev/tty because hosts buffer child stdout until exit"
date: 2026-07-25
source: "rrr: phd-citation-oracle"
concepts: [verification, tty, stdout-buffering, long-running-process, cli-ux, overconfidence, maw-plugin]
---

# Verify in the user's environment, not a proxy

## What happened

I added a `serve` verb to a maw plugin that starts a `Bun.serve()` HTTP server. The banner
(URL + stats) never appeared for the user — just a blank prompt after the command.

I fixed it once by moving the banner from the handler's returned `output` to `console.log`,
tested it with `maw citation serve > /tmp/log 2>&1 &`, saw the banner in the log, and told the
user to run it again. **It still printed nothing.** They ran it twice, got silence twice.

Two distinct bugs were hiding behind the same symptom:

1. **`process.exit()` killed the server.** The CLI entrypoint had
   `if (args[0] !== "visualize") process.exit(result.ok ? 0 : 1)` — an exit guard written when
   `visualize` was the only long-running verb. Adding the `serve` alias meant `serve` fell
   through and exited immediately, so nothing was ever listening. (The banner *did* appear in my
   redirected test — precisely **because** the process exited, which flushed the buffer.)
2. **The host buffers plugin stdout until the process exits.** Once the server correctly stayed
   alive, `console.log` output sat in a pipe forever.

## The fix

```ts
// A host buffers a plugin's stdout and flushes it only when the process exits — which never
// happens for a server. Writing to the controlling terminal bypasses that pipe; fall back to
// stdout when there is no tty (piped runs, CI).
async function announce(text: string): Promise<void> {
  try { await Bun.write("/dev/tty", `${text}\n`); }
  catch { console.log(text); }
}

const LONG_RUNNING = new Set(["serve", "visualize"]);
if (!LONG_RUNNING.has(args[0] ?? "") || !result.ok) process.exit(result.ok ? 0 : 1);
```

Verified with a real pseudo-terminal, which is the test I should have written first:

```bash
script -q /dev/null bash -c 'cd repo && maw citation serve --port 5630' > /tmp/pty.log 2>&1 &
sleep 7; cat /tmp/pty.log     # banner present
curl -s -o /dev/null -w '%{http_code}' http://localhost:5630/   # 200
```

## Rules to carry forward

- **Test through the user's surface.** Output buffering, TTY detection, colour, spinners and
  line-wrapping all take different code paths through a pipe than through a terminal. If the
  user runs it in a terminal, test it under a PTY: `script -q /dev/null <cmd>`.
- **A banner from a process that never exits must not go through stdout.** Write to `/dev/tty`
  with a stdout fallback.
- **"It appeared in my log" can be evidence of the opposite bug.** My redirected test only
  succeeded because the process was dying — the very failure I was trying to fix. When a test
  passes for a reason you haven't identified, you haven't tested it.
- **Adding an alias means auditing every place the old name is special-cased** — exit guards,
  command allow-lists, help text, docs.
- **Don't tell the user "it's fixed, try again" from an unrepresentative test.** Two blind runs
  on their side is the cost of my overconfidence. Either reproduce their exact invocation, or
  say plainly that the fix is unverified in their environment.

Related: [[verify-a-peers-negative-claim]] — the same session's other lesson, about not
accepting "X doesn't exist" from a teammate without checking its own artifacts.
