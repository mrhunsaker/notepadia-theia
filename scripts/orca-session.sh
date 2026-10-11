#!/usr/bin/env bash
#
# Orca screen-reader session for the browser build (Run A of
# docs/screen-reader-test-plan.md).
#
# Starts Orca with every announcement logged, opens the app in Chrome for
# Testing with accessibility enabled and the app window focused, waits while
# you drive the app by keyboard, then stops the session and writes a cleaned
# transcript (the SPEECH OUTPUT lines only).
#
# Orca speaks audibly through the system speech-dispatcher while it works; the
# logging is what produces the transcript you paste into the plan.
#
# Usage:
#   scripts/orca-session.sh              open the app for you, audible Orca
#   scripts/orca-session.sh --no-chrome  app already open in your browser
#   scripts/orca-session.sh --extract-only /tmp/orca-speech.log
#                                        re-extract a transcript from an earlier
#                                        run (no session is started)
#
# Options:
#   --url URL          app URL (default http://127.0.0.1:3100/)
#   --log FILE         Orca debug log (default /tmp/orca-speech.log)
#   --transcript FILE  cleaned SPEECH OUTPUT transcript
#                      (default: <log file base>-transcript.txt)
#   --chrome BIN       Chrome for Testing binary (default: first one found
#                      under ~/.cache/puppeteer)
#   --no-chrome        do not open a browser window
#   --extract-only LOG stop after writing the transcript for LOG
#   -h, --help         this help
#
# Notes:
#   - `orca --debug` is required: without it the debug file never gets
#     SPEECH OUTPUT lines. The harness always passes it.
#   - Orca announces whichever window currently has focus. Keep only the app
#     window open (and nothing else focused) while you work, so the transcript
#     is clean.
#   - This starts Orca with --replace: any Orca already running is stopped
#     first.
#   - There is no silent mode: the distro's speech-dispatcher "dummy" output
#     cannot open a device on this box ("Cannot open plugin server"), so the
#     run is heard OR the reader falls back to the system speech. Audibility is
#     expected on a screen-reader run anyway; the text is what you keep.
set -u

URL="http://127.0.0.1:3100/"
LOG="/tmp/orca-speech.log"
TRANSCRIPT=""
OPEN_CHROME=1
CHROME_BIN=""
EXTRACT_ONLY=0

usage() {
  sed -n '2,38p' "$0" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --log) LOG="$2"; shift 2 ;;
    --transcript) TRANSCRIPT="$2"; shift 2 ;;
    --chrome) CHROME_BIN="$2"; shift 2 ;;
    --no-chrome) OPEN_CHROME=0; shift ;;
    --extract-only) EXTRACT_ONLY=1; LOG="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
done

find_chrome() {
  if [ -n "$CHROME_BIN" ] && [ -x "$CHROME_BIN" ]; then
    printf '%s\n' "$CHROME_BIN"
    return 0
  fi
  local candidate
  candidate=$(ls -1 "$HOME"/.cache/puppeteer/chrome/*/chrome-linux64/chrome 2>/dev/null | head -1)
  [ -n "$candidate" ] && printf '%s\n' "$candidate"
}

extract_transcript() {
  local src="$1" dst="$2"
  grep 'SPEECH OUTPUT' "$src" | sed -E "s/^[0-9:.]+ - SPEECH OUTPUT: //; s/ \{.*$//" > "$dst"
}

if [ "$EXTRACT_ONLY" = 1 ]; then
  [ -f "$LOG" ] || { echo "no such log: $LOG" >&2; exit 1; }
  extract_transcript "$LOG" "$TRANSCRIPT"
  echo "wrote transcript: $TRANSCRIPT ($(wc -l < "$TRANSCRIPT") announcements)"
  exit 0
fi

WORK=$(mktemp -d /tmp/orca-session.XXXXXX)
ORCA_PID=""
CHROME_PID=""

# A leftover private-bus address from an earlier experiment would silently
# leave Orca with no reachable speech backend; the harness always uses the
# standard system speech-dispatcher.
unset SPEECHD_ADDRESS 2>/dev/null || true

cleanup() {
  [ -n "$CHROME_PID" ] && kill -- "-$CHROME_PID" 2>/dev/null
  [ -n "$ORCA_PID" ] && kill "$ORCA_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "Recording an Orca session against $URL"
echo "  version info (paste into the /docs/screen-reader-test-plan.md record):"
orca --version 2>&1 | sed 's/^/    /'
if [ "$OPEN_CHROME" = 1 ]; then
  CHROME_BIN=$(find_chrome)
  if [ -n "$CHROME_BIN" ]; then
    "$CHROME_BIN" --version 2>/dev/null | sed 's/^/    /'
  else
    echo "    (no Chrome for Testing found under ~/.cache/puppeteer)" >&2
    OPEN_CHROME=0
  fi
fi

if [ "$OPEN_CHROME" = 1 ]; then
  echo "  starting app window in Chrome for Testing (a11y forced on)..."
  rm -rf "$WORK/cud"
  setsid "$CHROME_BIN" \
    --user-data-dir="$WORK/cud" \
    --no-sandbox \
    --force-renderer-accessibility \
    --disable-dev-shm-usage \
    --no-first-run \
    --no-default-browser-check \
    --window-size=1400,900 \
    "$URL" >/dev/null 2>&1 &
  CHROME_PID=$!
  sleep 6
  echo "  (stays up? $([ "$(kill -0 "$CHROME_PID" 2>/dev/null; echo $?)" = 0 ] && echo yes || echo no - check server on $URL))"
fi

rm -f "$LOG"
echo "  starting Orca (replacing any existing instance) -> $LOG"
orca --replace --speech-system speechd --debug --debug-file="$LOG" > "$WORK/orca.stdout" 2>&1 &
ORCA_PID=$!

ready=0
for _ in $(seq 1 45); do
  grep -q 'SPEECH OUTPUT' "$LOG" 2>/dev/null && { ready=1; break; }
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "warning: no SPEECH OUTPUT yet after 45s; app window may be unfocused or" >&2
  echo "Orca failed to start. Orca stdout is at $WORK/orca.stdout" >&2
fi

cat << 'EOF'

Now walk the checklist in docs/screen-reader-test-plan.md (Run A, sections 1-5)
section by section, pausing between actions so each announcement is logged.
Rules for a clean transcript:
  * keep ONLY the app window open, and let it keep focus the whole time
  * navigate by keyboard (Alt+Tab to focus the app window first if needed)
  * a short pause after each step is fine; the transcript is timestamped

EOF
echo "Press ENTER here when the run is finished."
read -r _

if [ -z "$TRANSCRIPT" ]; then
  TRANSCRIPT="${LOG%.log}-transcript.txt"
fi
extract_transcript "$LOG" "$TRANSCRIPT"

echo
echo "done."
echo "  debug log (everything):   $LOG"
echo "  cleaned transcript:       $TRANSCRIPT ($(wc -l < "$TRANSCRIPT") announcements)"
echo "Next: paste the transcript into the Run A record in"
echo "docs/screen-reader-test-plan.md and mark each section as verified."