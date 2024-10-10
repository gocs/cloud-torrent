!(() => {
    const $system = document.getElementById("system")
    if (!$system) return;
    const $goroutines = document.getElementById("goroutines")
    if (!$goroutines) return;
    const $gomem = document.getElementById("gomem")
    if (!$gomem) return;
    const $cpu = document.getElementById("cpu")
    if (!$cpu) return;
    const $mem = document.getElementById("mem")
    if (!$mem) return;
    const $disk = document.getElementById("disk")
    if (!$disk) return;
    const $uptime = document.getElementById("uptime")
    if (!$uptime) return;
    const $runtime = document.getElementById("runtime")
    if (!$runtime) return;
    const $version = document.getElementById("version")
    if (!$version) return;
    const $title = document.getElementById("title")
    if (!$title) return;
    const $usercount = document.getElementById("usercount")
    if (!$usercount) return;
    const $downloads = document.getElementById("downloads")
    if (!$downloads) return;
    const $list_item_tmpl = document.getElementById("list-item-tmpl")
    if (!$list_item_tmpl) return;
    const $free_download_space = document.getElementById("free-download-space")
    if (!$free_download_space) return;

    // config
    const $auto_start = document.getElementById("auto-start")
    if (!$auto_start) return;
    const $disable_encryption = document.getElementById("disable-encryption")
    if (!$disable_encryption) return;
    const $download_directory = document.getElementById("download-directory")
    if (!$download_directory) return;
    const $enable_seeding = document.getElementById("enable-seeding")
    if (!$enable_seeding) return;
    const $enable_upload = document.getElementById("enable-upload")
    if (!$enable_upload) return;
    const $incoming_port = document.getElementById("incoming-port")
    if (!$incoming_port) return;
    const $config = document.getElementById("config")
    if (!$config) return;
    const $config_toggle = document.getElementById("config-toggle")
    if (!$config_toggle) return;
    const $magnet = document.getElementById("magnet")
    if (!$magnet) return;
    const $magnet_toggle = document.getElementById("magnet-toggle")
    if (!$magnet_toggle) return;
    const $edit_magnet_toggle = document.getElementById("edit-magnet-toggle")
    if (!$edit_magnet_toggle) return;

    // omni
    const $omni = document.getElementById("omni")
    if (!$omni) return;
    const $omnierr = document.getElementById("omnierr")
    if (!$omnierr) return;
    const $name = document.getElementById("name")
    if (!$name) return;
    const $infohash = document.getElementById("infohash")
    if (!$infohash) return;
    const $tracker_tmpl = document.getElementById("tracker-tmpl")
    if (!$tracker_tmpl) return;
    const $trackers = document.getElementById("trackers")
    if (!$trackers) return;

    // search
    const $load_magnet = document.getElementById("load-magnet")
    if (!$load_magnet) return;

    if (!toRelativeTime) return;
    // Test to see if the browser supports the HTML template element by checking
    // for the presence of the template element's content attribute.
    if (!("content" in document.createElement("template"))) return;

    let stats = {}
    let config = {}
    let downloads = {}
    let torrents = {}
    let users = {}
    let searchProviders = {}
    let storage = (() => { // factory sim
        return window.localStorage || {}
    })()
    let inputs = {
        omni: storage.tcOmni || "",
        provider: storage.tcProvider || "1337x"
    }

    const e = new EventSource("/sync");
    e.onopen = () => {

        e.onmessage = function (m) {
            let data = JSON.parse(m.data)

            if (!data.body) return;
            for (const [k, v] of Object.entries(data.body)) {
                if (k === "Stats") {
                    stats = v
                    set_info_from_stat()
                    continue
                }
                if (k === "Config") {
                    config = v
                    set_info_from_config()
                    continue
                }
                if (k === "Downloads") {
                    downloads = v
                    if (!downloads.Children) {
                        const li = $list_item_tmpl.content.cloneNode(true);
                        li.innerHTML = "<li>no downloads</li>"
                        $downloads.appendChild(li)
                    } else {
                        list_downloads($downloads, downloads.Children)
                    }
                    continue
                }
                if (k === "Torrents") {
                    torrents = v
                    continue
                }
                if (k === "Users") {
                    users = v
                    continue
                }
                if (k === "SearchProviders") {
                    searchProviders = v
                    console.log("watching searchProviders:", searchProviders);
                    continue
                }

                if (!v.op || !v.path || !v.value || !v.path.includes("/Stats/System"))
                    continue

                if (v.op === "replace") {
                    switch (v.path) {
                        case "/Stats/System/goRoutines":
                            $goroutines.innerText = v.value
                            break
                        case "/Stats/System/goMemory":
                            $gomem.innerText = bytes(v.value)
                            break
                        case "/Stats/System/cpu":
                            $cpu.innerText = round(v.value)
                            break
                        case "/Stats/System/memoryUsed":
                            if (!stats.System.memoryTotal) continue
                            let usage1 = 100 * v.value / stats.System.memoryTotal
                            $mem.innerText = round(usage1)
                            break
                        case "/Stats/System/diskUsed":
                            if (!stats.System.diskTotal) continue
                            let usage2 = 100 * v.value / stats.System.diskTotal
                            $disk.innerText = round(usage2)
                            break
                    }
                }
            }

            // uptime has to update too
            if (stats.Uptime)
                $uptime.innerText = toRelativeTime(stats.Uptime);
        }
    }

    // // hide it first; tailwind can't include this if not added in html
    // $config_toggle.classList.toggle("stroke-green-600")
    $config.classList.add("hidden")
    $config.classList.remove("flex")
    $config_toggle.addEventListener("click", function (e) {
        $config.classList.toggle("hidden")
        $config.classList.toggle("flex")
        $config_toggle.classList.toggle("stroke-green-600")
    })
    $magnet.classList.add("hidden")
    $magnet.classList.remove("flex")
    $magnet_toggle.addEventListener("click", function (e) {
        $magnet.classList.toggle("hidden")
        $magnet.classList.toggle("flex")
        $magnet_toggle.classList.toggle("fill-green-600")
    })
    $edit_magnet_toggle.addEventListener("click", function (e) {
        $magnet.classList.toggle("hidden")
        $magnet.classList.toggle("flex")
        $magnet_toggle.classList.toggle("fill-green-600")
    })

    function set_info_from_stat() {
        if (!stats) return;
        if (!stats.System) return;

        if (stats.Title) {
            $title.innerText = stats.Title
        }
        if (stats.Version) {
            $version.innerText = stats.Version
        }
        if (stats.Runtime) {
            $runtime.innerText = stats.Runtime
        }
        if (stats.Uptime) {
            $uptime.title = stats.Uptime;
            $uptime.innerText = toRelativeTime(stats.Uptime);
        }
        if (stats.System.goRoutines) $goroutines.innerText = stats.System.goRoutines
        if (stats.System.goMemory) $gomem.innerText = bytes(stats.System.goMemory)
        if (stats.System.cpu) $cpu.innerText = round(stats.System.cpu)
        if (stats.System.memoryUsed && stats.System.memoryTotal) {
            let usage = 100 * stats.System.memoryUsed / stats.System.memoryTotal
            $mem.innerText = round(usage)
        }
        if (stats.System.diskUsed && stats.System.diskTotal) {
            let usage = 100 * stats.System.diskUsed / stats.System.diskTotal
            $disk.innerText = round(usage)
        }
        if (stats.System.set) {
            $free_download_space.textContent = bytes(stats.System.diskTotal - stats.System.diskUsed)
        }
    }

    function set_info_from_config() {
        if (!config) return
        $auto_start.checked = !!config.AutoStart
        $disable_encryption.checked = !!config.DisableEncryption
        $download_directory.value = config.DownloadDirectory
        $enable_seeding.checked = !!config.EnableSeeding
        $enable_upload.checked = !!config.EnableUpload
        $incoming_port.value = config.IncomingPort
    }

    function list_downloads($, children, ancestor = []) {
        if (!children || children.length < 1) return
        for (const [k, v] of Object.entries(children)) {
            let a = [...ancestor, v.Name]

            const li = $list_item_tmpl.content.cloneNode(true);
            let icon = li.getElementById("icon")
            let name = li.getElementById("name")
            name.textContent = v.Name
            name.href = "download/" + a.join("/")
            let size = li.getElementById("size")
            size.textContent = bytes(v.Size)
            let modified = li.getElementById("modified")
            modified.textContent = toRelativeTime(v.Modified)
            let trash = li.getElementById("trash")
            let loading = li.getElementById("loading")
            trash.addEventListener("click", deleteEntry(trash, loading))

            if (v.Children) {
                let $children = li.getElementById("children")
                icon.classList.add("cursor-pointer")
                icon.addEventListener("click", setIconEvent($children))
                list_downloads($children, v.Children, a)
            } else {
                let [type, html] = setIcon(v.Name)
                if (type != "file") {
                    let typeid = type + "-preview"
                    li.getElementById(typeid).src = name.href
                    if (type != "image") setPlayMedia(li, typeid)
                }

                icon.innerHTML = html
            }
            $.appendChild(li)
        }
    }

    const AUDIO_TYPES = /\.(webm|mp3|m4a)$/
    const IMAGE_TYPES = /\.(webp|jpe?g|png|gif)$/
    const VIDEO_TYPES = /\.(webm|mp4|mkv|mov)$/
    function setIcon(name) {
        if (AUDIO_TYPES.test(name)) return ["audio", AUDIO_ICON]
        else if (IMAGE_TYPES.test(name)) return ["image", IMAGE_ICON]
        else if (VIDEO_TYPES.test(name)) return ["video", VIDEO_ICON]
        else return ["file", FILE_ICON]
    }
    // const AUDIO_TYPES = [".webm", ".mp3", ".ogg", ".wav", ".flac", ".m4a", ".m4a"]
    // const IMAGE_TYPES = [".webp", ".png", ".jpg", ".jpeg", ".gif"]
    // const VIDEO_TYPES = [".webm", ".mp4", ".mkv", ".mkv", ".avi", ".mpeg"]
    // function endsIncludes(subject = '', cases = []) {
    //     for (const type of cases) if (subject.endsWith(type)) return true
    //     return false
    // }

    function setIconEvent(c) {
        return function (e) {
            e.stopPropagation()
            e.preventDefault()
            c.classList.toggle("hidden")
            for (const el of icon.children) {
                el.classList.toggle("hidden")
            }
        }
    }

    function deleteEntry(trash, loading) {
        return async function (e) {
            loading.classList.toggle("hidden")
            trash.classList.toggle("hidden")
            await new Promise((r) => setTimeout(r, 1000))
            trash.classList.toggle("hidden")
            loading.classList.toggle("hidden")
        }
    }

    function setPlayMedia(li, typeid) {
        let hidden = li.querySelectorAll(`.hidden:has(#${typeid})`)
        let play = li.getElementById("play")
        play.classList.toggle("hidden")
        for (const [_, v] of hidden.entries()) play.addEventListener("click", function (e) {
            let res = v.classList.toggle("hidden")
            if (!res) v.play()
            else v.pause()
        })

    }

    function bytes(n, d) {
        // set defaults
        if (typeof n !== "number" || isNaN(n) || n == 0) return "0 B";
        if (!d || typeof d !== "number") d = 1;
        // set scale index 1000,100000,... becomes 1,2,...
        let i = Math.floor(Math.floor(Math.log(n) * Math.LOG10E) / 3);
        // set rounding factor
        let f = Math.pow(10, d);
        // scale n down and round
        let s = Math.round(n / Math.pow(10, i * 3) * f) / f;
        // concat (no trailing 0s) and choose scale letter
        return (
            s.toString().replace(/\.0+$/, "") +
            " " +
            ["", "K", "M", "G", "T", "P", "Z"][i] +
            "B"
        );
    };

    function round(n) {
        if (typeof n !== "number") return n;
        return Math.round(n * 10) / 10;
    };

    let mode = {
        torrent: false,
        magnet: false,
        search: false,
    }
    let page = 1;
    let hasMore = true;
    let noResults = false;
    let results = [];
    let ts = [];
    let edit = false;

    function parse(entry) {
        inputs.omni = entry
        storage.tcOmni = inputs.omni
        $omnierr.classList.add("hidden")
        $omnierr.textContent = "no comment";
        mode = {
            //set all 3 to false,
            //one will set to be true
            torrent: false,
            magnet: false,
            search: false,
        }
        page = 1;
        hasMore = true;
        noResults = false;
        results = [];


        if (/^https?:\/\//.test(entry)) parseTorrent();
        else if (/^magnet:\?(.+)$/.test(entry)) parseMagnet(RegExp.$1);
        else if (entry) parseSearch();
        else edit = false;
    }

    function parseTorrent() {
        mode.torrent = true
    }
    function parseMagnet(params) {
        mode.magnet = true
        let sp = new URLSearchParams(params)
        let m = Object.fromEntries(sp)  // window.queryString.parse
        ts = sp.getAll("tr")          // equivalent
        if (!/^urn:btih:([A-Za-z0-9]+)$/.test(m.xt)) {
            $omnierr.classList.remove("hidden")
            $omnierr.textContent = "Invalid Info Hash";
            return;
        }
        $infohash.value = RegExp.$1;
        $name.value = m.dn || "";
        //no trackers :O
        if (!ts) ts = [];
        //force array
        if (!(ts instanceof Array)) ts = [ts];

        //in place map
        renderTrackers()
    }
    $trackers.appendChild($tracker_tmpl.content.cloneNode(true))

    function renderTrackers() {
        $trackers.innerHTML = ""

        for (const tr of ts) {
            const input = $tracker_tmpl.content.cloneNode(true);
            let t = input.querySelector("[data-tracker]")
            t.value = tr
            t.dataset.old = tr
            t.removeEventListener("change", updatingTrackers)
            t.addEventListener("change", updatingTrackers)
            $trackers.appendChild(input)
        }
        const input = $tracker_tmpl.content.cloneNode(true);
        let t = input.querySelector("[data-tracker]")
        t.dataset.old = ""
        t.addEventListener("change", updatingTrackers)
        $trackers.appendChild(input)
    }

    function updatingTrackers(e) {
        const old_value = e.target.dataset.old
        const new_value = e.target.value
        if (new_value) {
            if (old_value === "") // new entry
                ts.push(new_value)
            else // update existing
                for (let i = 0; i < ts.length; i++)
                    if (ts[i] === old_value)
                        ts[i] = new_value
        } else ts = ts.filter(t => t != old_value) // remove the empty element
        renderTrackers()
    }


    function parseSearch() {
        mode.search = true
        while (results.length) results.pop();
    }

    function magnetURI(name, infohash, trackers) {
        return (
            "magnet:?" +
            "xt=urn:btih:" +
            (infohash || "") +
            "&" +
            "dn=" +
            (name || "").replace(/\W/g, "").replace(/\s+/g, "+") +
            (trackers || [])
                .filter(t => !!t.v)
                .map(t => "&tr=" + encodeURIComponent(t.v))
                .join("")
        );
    };

    // $omnierr.classList.add("hidden")
    // no modifiers on keyup because "modifiers + key" is 2 keypress and 2 event triggers
    $omni.addEventListener("keyup", function (e) {
        if (e.key == "Enter") {
            submitOmni(e)
            return
        }

        // any modifier key must be simultaneously be clicked by a non-modifier key
        // (e.<mod>Key <=> e.key anyof [Control Shift Alt Meta]) -> return
        let a_modifier_is_on = e.ctrlKey || e.shiftKey || e.altKey || e.metaKey
        if (a_modifier_is_on && ["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
        const entry = e.target.value
        parse(entry);
    })
    $omni.value = storage.tcOmni;
    parse($omni.value);


    $load_magnet.addEventListener("click", submitOmni)

    function submitOmni(e) {
        if (mode.search) submitSearch()
        else submitTorrent()
    }

    function submitSearch() {
        let provider = searchProviders[inputs.provider];
        if (!provider) return;
        let origin = /(https?:\/\/[^\/]+)/.test(provider.url) && RegExp.$1;

        search_all(inputs.provider, inputs.omni, page).then(async r => {
            console.log("r", r);
            let _results = await r.json();
            console.log("results:", _results);

            if (!_results || _results.length === 0) {
                noResults = true
                hasMore = false
                return
            }
            for (let r of _results) {
                if (r.url && /^\//.test(r.url)) {
                    r.path = r.url;
                    r.url = origin + r.path;
                }
                if (r.torrent && /^\//.test(r.torrent)) {
                    r.torrent = origin + r.torrent;
                }
                results.push(r)
            }
            page++
        })
    }

    function submitTorrent() {
        if (mode.torrent) api_url(inputs.omni)
        else if (mode.magnet) api_magnet(inputs.omni)
        else window.alert("UI Bug")
    }

    let searching = false
    let apiing = false
    function api_configure(data) {
        fetch("api/configure", { method: "POST", body: JSON.stringify(data) })
            .then(r => { console.log("success:", r); })
            .catch(e => { console.log("error:", e); })
            .finally(() => { apiing = false })
    }
    function api_magnet(data) {
        fetch("api/magnet", { method: "POST", body: JSON.stringify(data) })
            .then(r => { console.log("success:", r); })
            .catch(e => { console.log("error:", e); })
            .finally(() => { apiing = false })
    }
    function api_url(data) {
        fetch("api/url", { method: "POST", body: JSON.stringify(data) })
            .then(r => { console.log("success:", r); })
            .catch(e => { console.log("error:", e); })
            .finally(() => { apiing = false })
    }
    function api_torrent(data) {
        fetch("api/torrent", { method: "POST", body: JSON.stringify(data) })
            .then(r => { console.log("success:", r); })
            .catch(e => { console.log("error:", e); })
            .finally(() => { apiing = false })
    }
    function api_file(data) {
        fetch("api/file", { method: "POST", body: JSON.stringify(data) })
            .then(r => { console.log("success:", r); })
            .catch(e => { console.log("error:", e); })
            .finally(() => { apiing = false })
    }
    function api_torrentfile(data) {
        fetch("api/torrentfile", { method: "POST", body: JSON.stringify(data) })
            .then(r => { console.log("success:", r); })
            .catch(e => { console.log("error:", e); })
            .finally(() => { apiing = false })
    }


    async function search_all(provider, query, page) {
        let params = { query }
        if (page !== undefined) params.page = page
        searching = true

        let opts = {
            method: "POST",
            body: JSON.stringify({ params })
        }
        let res;
        try { res = await fetch("search/" + provider, opts) } catch (e) {
            console.error(`Failed to search ${provider} for ${query}`, e)
        } finally { searching = false }

        return res;
    }
    async function search_one(provider, path) {
        let opts = {
            method: "POST",
            body: JSON.stringify({ params: { items: path } })
        }
        searching = true

        let res;
        try { res = await fetch("search/" + provider + "/item", opts) } catch (e) {
            console.error(`Failed to seach ${provider} for ${query}`, e);
        } finally { searching = false }
        return res
    }
})()

const VIDEO_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
  <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
</svg>
`

const AUDIO_ICON = `
<svg width="18px" height="18px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
</svg>
`

const FILE_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
</svg>
`