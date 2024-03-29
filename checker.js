const ERROR_LEVEL = {
    WARNING: 1,
    CRITICAL: 2
};

var setProgress, setStatusText;
var tokenizer, token;

window.addEventListener("load", function () {

    const progress = document.getElementById("progress"),
    progressBar = progress.getElementsByTagName("progress")[0];

    setProgress = (p) => {
        progressBar.setAttribute("value", p);
    };

    const status = document.getElementById("status");
    setStatusText = (text, duration) => {
        status.innerHTML = text;

        progress.style.display = (text) ? "block" : "none";

        if (duration) {
            setTimeout(() => {
                setStatusText();
            }, duration);
        }
    };

    const dz = document.getElementById("dropzone");

    dz.addEventListener("click", () => {
        let btn = document.createElement("input");
        btn.type = "file";
        btn.onchange = (e) => {
            dz.style.display = "none";
            loadFiles(e.target.files);
        };
        btn.click();
    });

    dz.addEventListener("dragover", (e) => {
        e.preventDefault();
        dz.classList.add("dropready");
    });

    dz.addEventListener("dragleave", (e) => {
        dz.classList.remove("dropready");
    });

    dz.addEventListener("drop", (e) => {
        e.preventDefault();
        dz.style.display = "none";
        loadFiles(e.dataTransfer.files);
    });

    setStatusText("Loading tokenizer...");

    kuromoji.builder({dicPath: "./lib/kuromoji.js/dict"}).build(function (err, tknzr) {

        tokenizer = tknzr;

        setStatusText("Ready!", 1000);

    });

});


function loadFiles(files) {
    const outList = document.getElementById("output").getElementsByTagName("ul")[0];
    const addListItem = (html) => {
        outList.innerHTML += html;
    };

    token = {};

    let result = Promise.resolve();

    for (const file of files) {

        const v = new Checker(setProgress);

        result = result.then(() => {

            setStatusText("Parsing " + file.name + "...");
            return v.loadAndCheck(file);

        }).then(() => {

            let r, html = "";
            html += "<li>" + file.name + ":";
            html += " <ul>";

            html += "  <li>" + v.stats.contextCount + " contexts, " + v.stats.messageCount + " messages, " + v.stats.untranslatedCount + " untranslated</li>";

            html += "  <li>" + v.results[ERROR_LEVEL.CRITICAL].length + " critical errors";
            html += "   <ul>";
            for (r of v.results[ERROR_LEVEL.CRITICAL]) {
                html += "<li>" + r.msg;
                html += "<div>[" + r.context + "]</div>";
                html += "<div>" + r.source + "</div>";
                html += "<div>" + r.translation + "</div></li>";
            }
            html += "   </ul>";
            html += "  </li>";

            html += "  <li>" + v.results[ERROR_LEVEL.WARNING].length + " warnings";
            html += "   <ul>";
            for (r of v.results[ERROR_LEVEL.WARNING]) {
                html += "<li>" + r.msg;
                html += "<div>[" + r.context + "]</div>";
                html += "<div>" + r.source + "</div>";
                html += "<div>" + r.translation + "</div></li>";
            }
            html += "   </ul>";
            html += "  </li>";

            html += " </ul>";
            html += "</li>";

            addListItem(html);
        });
    }
    result = result.then(() => {
        console.log("Unknown words:");
        console.log(token);

        let words = [];
        for (let k of Object.keys(token).sort()) {
            words.push("<div>" + k.replace("<", "&lt;").replace(">", "&gt") + ": " + token[k] + "</div>");
        }
        addListItem("<li>" + words.join("") + "</li>");

        setStatusText("Completed!", 2000);
    });
}


class Checker {

    constructor(progressFunc) {

        this.CONTEXTS_PER_JOB = 10;

        this.results = [];
        this.results[ERROR_LEVEL.CRITICAL] = [];
        this.results[ERROR_LEVEL.WARNING] = [];

        this.stats = {
            contexts: [],
            contextCount: 0,
            messageCount: 0,
            untranslatedCount: 0
        };

        this.progressFunc = progressFunc;

        this.contexts = [];
    }

    loadAndCheck(file) {

        this.counter = 0;

        return new Promise((resolve) => {

            const reader = new FileReader();
            reader.readAsText(file);

            reader.onload = (e) => {
                const xmlStr = e.target.result;
                const dom = new DOMParser().parseFromString(xmlStr, "text/xml");
                const root = dom.documentElement;

                this.lang = root.getAttribute("language");
                this.contexts = [...root.children];     // HTMLCollection to array

                this._checkNextContext(resolve);
            };
        });
    }

    _checkNextContext(resolve) {

        if (this.contexts.length == 0) {
            this.progressFunc(1);

            resolve();
            return;
        }

        const context = this.contexts.shift();

        const name = context.getElementsByTagName("name")[0].textContent;
        const messages = context.getElementsByTagName("message");
        const stats = {
            name: name,
            messageCount: messages.length,
            untranslatedCount: 0
        };

        let source, translation, type, result;

        for (const message of messages) {
            source = message.getElementsByTagName("source")[0];
            translation = message.getElementsByTagName("translation")[0];
            type = translation.getAttribute("type");
            if (type === null) {
                result = checkTranslation(source.textContent, translation.textContent, this.lang);
                if (result) {
                    result.context = name;
                    result.source = source.textContent;
                    result.translation = translation.textContent;

                    this.results[result.level].push(result);
                }
            }
            else if (type == "unfinished") {
                stats.untranslatedCount++;
            }
        }

        this.stats.contexts.push(stats);
        this.stats.contextCount++;
        this.stats.messageCount += stats.messageCount;
        this.stats.untranslatedCount += stats.untranslatedCount;

        ++this.counter;
        if (this.counter == this.CONTEXTS_PER_JOB) {
            const _this = this;
            setTimeout(() => {
                _this._checkNextContext(resolve);
            }, 0);
            this.counter = 0;
            this.progressFunc((this.stats.contextCount - this.contexts.length) / this.stats.contextCount);
        }
        else {
            this._checkNextContext(resolve);
        }
    }
}


const ph1 = `%[0-9a-z]`;
const ph2 = `{.*?}`;

function checkTranslation(s, t, lang) {

    let msg = "";

    // critical errors
    if ([...s.matchAll(ph1)].sort().toString() != [...t.matchAll(ph1)].sort().toString()) msg = "placeholders unmatched (%)";
    else if ([...s.matchAll(ph2)].sort().toString() != [...t.matchAll(ph2)].sort().toString()) msg = "placeholders unmatched ({})";

    if (msg) {

        return {
            level: ERROR_LEVEL.CRITICAL,
            msg: msg
        };

    }

    // warnings
    if (t.trim() == "" && s.trim() != "") msg = "empty translation";
    else if (s.slice(-3) == "..." && t.slice(-3) != "...") msg = "missing ... (3 dots)";

    if (lang == "ja") {

        if (s.slice(-1) == "…" && t.slice(-3) != "...") msg = "missing ... (must be 3 dots)";
        else if (t.indexOf("…") != -1) msg = "ellipsis used";
        else if (s.indexOf("....") == -1 && s.indexOf("……") == -1 && t.indexOf("....") != -1) msg = ".... (4 dots) used";

        if (tokenizer) {

            var path = tokenizer.tokenize(t);
            var w;
            for (let c of path) {
                w = c.surface_form;
                if (isNaN(w) && c.word_type == "UNKNOWN") {
                    if (s.indexOf(w) == -1) {
                        token[w] = (token[w] === undefined) ? 1 : token[w] + 1;
                    }
                }
            }
            console.log(path);

        }

    }

    if (msg) {

        return {
            level: ERROR_LEVEL.WARNING,
            msg: msg
        };

    }

    return null;
}
