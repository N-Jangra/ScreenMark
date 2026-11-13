#!/usr/bin/env python3
"""Load test for compact in-memory details (ScreenMark) in headless Chrome with DUMMY data only.

Seeds N dummy titles (big details: episodes, cast, ratings) into a throw-away browser profile, opens the real app with the compact
mode on and off, and checks: heap size, that opening a title brings its full details back, that a status change keeps the stored
details, and that nothing is lost. Never touches a phone or real data.

usage: python3 tests/browser/slim-load.py [N]
"""
import base64, json, os, socket, subprocess, sys, tempfile, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
FE = os.path.abspath(os.path.join(HERE, "..", "..", "frontend"))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

import struct


def send(s, obj):
    data = json.dumps(obj).encode(); header = bytearray([0x81]); n = len(data)
    if n < 126: header.append(0x80 | n)
    elif n < 65536: header.append(0x80 | 126); header += struct.pack(">H", n)
    else: header.append(0x80 | 127); header += struct.pack(">Q", n)
    mask = os.urandom(4); header += mask
    s.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))


def recv(s):
    def read(n):
        out = b""
        while len(out) < n:
            chunk = s.recv(n - len(out))
            if not chunk: raise EOFError
            out += chunk
        return out
    payload = b""
    while True:
        b1, b2 = read(2); ln = b2 & 0x7F
        if ln == 126: ln = struct.unpack(">H", read(2))[0]
        elif ln == 127: ln = struct.unpack(">Q", read(8))[0]
        payload += read(ln)
        if b1 & 0x80: return payload.decode("utf-8", "replace")


class Chrome:
    def __init__(self, ud=None):
        self.port = 9500 + (os.getpid() + int(time.time())) % 400
        self.ud = ud or tempfile.mkdtemp(prefix="slim-ud-")
        self.proc = subprocess.Popen(["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", f"--remote-debugging-port={self.port}", f"--user-data-dir={self.ud}", "--window-size=390,844", "--js-flags=--expose-gc", "--enable-precise-memory-info", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            try: pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json")); break
            except Exception: time.sleep(0.3)
        page = next(p for p in pages if p.get("type") == "page")
        path = page["webSocketDebuggerUrl"].split(f"127.0.0.1:{self.port}")[1]
        self.s = socket.create_connection(("127.0.0.1", self.port), timeout=300)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{self.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf: buf += self.s.recv(4096)
        self.n = 0

    def call(self, method, params=None):
        self.n += 1; send(self.s, {"id": self.n, "method": method, "params": params or {}})
        while True:
            msg = json.loads(recv(self.s))
            if msg.get("id") == self.n: return msg.get("result", {})

    def js(self, expression):
        r = self.call("Runtime.evaluate", {"expression": expression, "awaitPromise": True, "returnByValue": True})
        if "exceptionDetails" in r: return {"__error": r["exceptionDetails"].get("exception", {}).get("description")}
        return r.get("result", {}).get("value")

    def open(self, url, wait=2.0):
        self.call("Page.navigate", {"url": url}); time.sleep(wait)

    def close(self):
        self.proc.terminate()


SEED = """<!doctype html><meta charset=utf-8><body><pre id=out>running</pre>
<script src="backend/idb-store.js"></script>
<script>
(async () => {
  const core = self.SplitAppIDBCore, N = %d;
  await new Promise(r => { const q = indexedDB.deleteDatabase('screenmark_library'); q.onsuccess = q.onerror = q.onblocked = () => r(); });
  const items = Array.from({ length: N }, (_, i) => ({ id: 'dummy-' + i, title: 'Dummy Show ' + i, category: 'series', status: i %% 7 === 0 ? 'In Progress' : 'Watchlist', year: String(1990 + i %% 35), createdAt: 1700000000000 + i, updatedAt: 1700000000000 + i, metadataSource: 'tvmaze', providerId: String(100000 + i),
    cachedDetails: { fetchedAt: 1700000000000, description: 'd'.repeat(600), genres: ['Drama'], fields: [{ label: 'Genre', value: 'Drama' }], raw: { junk: 'x'.repeat(800) },
      sections: [
        { kind: 'episodes', title: 'Episode guide (60)', items: Array.from({ length: 60 }, (_, n) => ({ id: i + '-' + n, title: 'Episode ' + n, season: 1 + (n / 12 | 0), number: n %% 12 + 1, airdate: '2021-01-01', summary: 's'.repeat(400), image: 'https://example.invalid/e.jpg', raw: { z: 'y'.repeat(200) } })) },
        { kind: 'ratings', title: 'Episode ratings', items: Array.from({ length: 60 }, (_, n) => ({ title: 'E' + n, rating: 7.5, votes: 1000 })) },
        { kind: 'people', title: 'Cast', items: Array.from({ length: 50 }, (_, n) => ({ title: 'Actor ' + n, bio: 'b'.repeat(300) })) }
      ] } }));
  await core.save({ items, history: [], preferences: { } });
  localStorage.setItem('splitapp_screenmark_v1_setup_done', '1');
  document.getElementById('out').textContent = 'done';
})();
</script>"""


def main():
    seed = os.path.join(FE, "__seed.html"); page = os.path.join(FE, "__app.html")
    open(seed, "w").write(SEED % N)
    html = open(os.path.join(FE, "index.html")).read().replace("<head>", '<head><script>try{localStorage.setItem("splitapp_screenmark_v1_setup_done","1")}catch(_){}</script>', 1)
    html = html.replace("</body>", '<script>setTimeout(()=>{document.getElementById("boot-splash")?.remove()},1500)</script></body>')
    open(page, "w").write(html)
    chrome = Chrome(); results = []
    def check(name, ok, extra=""): results.append((name, bool(ok), extra)); print(("PASS " if ok else "FAIL ") + name, extra)
    try:
        chrome.open("file://" + seed, 1)
        for _ in range(120):
            if chrome.js("document.getElementById('out').textContent") == "done": break
            time.sleep(1)
        check("seeded dummy titles", chrome.js("document.getElementById('out').textContent") == "done", f"N={N}")
        heaps = {}
        ud = chrome.ud
        for label, slim in (("full", None), ("compact", 100)):
            # a fresh browser process per mode, same profile (same stored data), so one run's garbage never inflates the other
            chrome.close(); time.sleep(1.5); chrome = Chrome(ud)
            chrome.open("file://" + page, 1)
            chrome.js("localStorage.removeItem('splitapp_screenmark_v1_slim_min')" if slim is None else f"localStorage.setItem('splitapp_screenmark_v1_slim_min','{slim}')")
            chrome.open("file://" + page + "#profile", 1)
            time.sleep(9)
            chrome.js("window.gc && window.gc()"); time.sleep(1); chrome.js("window.gc && window.gc()")
            heap = chrome.js("Math.round(performance.memory.usedJSHeapSize/1048576)")
            heaps[label] = heap
            print(f"  [{label}] JS heap after load: {heap} MB")
        chrome.close(); time.sleep(1.5); chrome = Chrome(ud)
        check("compact mode uses much less memory than full mode", heaps["compact"] is not None and heaps["compact"] < heaps["full"] * 0.5, f"{heaps}")
        # open a title in compact mode: the full details come back; change status: stored details survive
        chrome.open("file://" + page + "#details?id=dummy-5", 1)
        time.sleep(6)
        body = chrome.js("document.body.innerText")
        check("details page shows the full episode guide after hydration", isinstance(body, str) and "Episode 0" in body and "S02 | E01" in body, "")
        click = chrome.js("(()=>{const b=[...document.querySelectorAll('[data-detail-status-btn]')].find(x=>/Completed/.test(x.textContent)); if(!b) return 'no-button'; b.click(); return 'clicked'})()")
        time.sleep(3)
        stored = chrome.js("""(async()=>{const o=n=>new Promise((res,rej)=>{const r=indexedDB.open(n);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
          const db=await o('screenmark_library');const tx=db.transaction(['items','details']);
          const get=(s,id)=>new Promise((res,rej)=>{const q=tx.objectStore(s).get(id);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
          const [rec,detail,other,otherDetail]=await Promise.all([get('items','dummy-5'),get('details','dummy-5'),get('items','dummy-6'),get('details','dummy-6')]);
          const secs=d=>d&&d.sections?d.sections.map(s=>s.kind+':'+(s.items||[]).length):null;
          return {status:rec.status,sections:secs(detail&&detail.cachedDetails),hasSummary:!!(detail&&detail.cachedDetails.sections[0].items[0].summary),
            otherSections:secs(otherDetail&&otherDetail.cachedDetails),rowHasDetails:!!rec.cachedDetails,otherRowHasDetails:!!other.cachedDetails}})()""")
        print("  stored record after status change:", stored)
        check("status change was saved", click == "clicked" and isinstance(stored, dict) and stored.get("status") == "Completed", f"click={click}")
        check("stored details are still full after the save", isinstance(stored, dict) and stored.get("sections") == ["episodes:60", "ratings:60"] and stored.get("hasSummary") and not stored.get("rowHasDetails"), str(stored))
        check("untouched titles keep full details in their detail records", isinstance(stored, dict) and stored.get("otherSections") == ["episodes:60", "ratings:60"] and not stored.get("otherRowHasDetails"), "")
    finally:
        chrome.close()
        for f in (seed, page):
            try: os.remove(f)
            except OSError: pass
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
