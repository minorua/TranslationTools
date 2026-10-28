const ERROR_LEVEL = {
    WARNING: 1,
    ERROR: 2,
    UNTRANSLATED: -1
};

const LANG_LIST = [
    'ar', 'az', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'en_US', 'es', 'et', 'eu', 'fi', 'fr',
    'gl', 'hu', 'is', 'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl', 'pl', 'pt_BR', 'pt_PT', 'ro',
    'ru', 'sc', 'sk', 'sv', 'ta', 'tr', 'uk', 'vi', 'zh-Hans', 'zh-Hant'
];

const MAX_RESULTS = 300;

var setProgress, setStatusText;
var tokenizer;

let sourceBranch = 'master';
const searchableMessages = [];

window.addEventListener('load', function () {

    const progress = document.getElementById('progress'),
    progressBar = progress.getElementsByTagName('progress')[0];

    setProgress = (p) => {
        progressBar.setAttribute('value', p);
    };

    const status = document.getElementById('status');
    setStatusText = (text, duration) => {
        status.innerHTML = text;

        progress.style.display = (text) ? 'block' : 'none';

        if (duration) {
            setTimeout(() => {
                setStatusText();
            }, duration);
        }
    };

    LANG_LIST.forEach(function (lang) {
        document.getElementById('lang').options.add(new Option(lang, lang, false));
    });

    const searchInput = document.getElementById('search_input');
    const searchPopup = document.getElementById('search_popup');
    const regexSearchButton = document.getElementById('regex_search_button');
    const selectionSearchButton = document.getElementById('selection_search_button');
    let regexSearchEnabled = false;
    let selectedSearchText = '';
    let selectionSearchTimeout;

    document.addEventListener('selectionchange', () => {
        clearTimeout(selectionSearchTimeout);
        selectionSearchButton.hidden = true;

        const selection = window.getSelection();
        const result = document.getElementById('result');
        if (!selection || selection.isCollapsed || !result.contains(selection.anchorNode) ||
            !result.contains(selection.focusNode) || !selection.toString().trim()) {
            selectedSearchText = '';
            return;
        }

        const selectedText = selection.toString().trim();
        selectionSearchTimeout = setTimeout(() => {
            const currentSelection = window.getSelection();
            if (!currentSelection || currentSelection.isCollapsed ||
                !result.contains(currentSelection.anchorNode) || !result.contains(currentSelection.focusNode) ||
                currentSelection.toString().trim() !== selectedText) {
                return;
            }

            selectedSearchText = selectedText;
            selectionSearchButton.hidden = false;

            const bounds = currentSelection.getRangeAt(0).getBoundingClientRect();
            const buttonBounds = selectionSearchButton.getBoundingClientRect();
            const left = Math.min(bounds.right, window.innerWidth - buttonBounds.width);
            const top = Math.min(bounds.top - 24, window.innerHeight - buttonBounds.height - 24);
            selectionSearchButton.style.left = `${Math.max(8, left)}px`;
            selectionSearchButton.style.top = `${Math.max(8, top)}px`;
        }, 300);
    });

    selectionSearchButton.addEventListener('pointerdown', (e) => {
        e.preventDefault();
    });

    selectionSearchButton.addEventListener('click', () => {
        if (!selectedSearchText) return;

        clearTimeout(selectionSearchTimeout);
        selectionSearchButton.hidden = true;
        searchInput.value = selectedSearchText;
        searchInput.focus();

        setTimeout(() => {
            showSearchResults(searchInput.value, searchPopup, searchInput, regexSearchEnabled);
        }, 300);
    });

    searchInput.addEventListener('input', () => {
        showSearchResults(searchInput.value, searchPopup, searchInput, regexSearchEnabled);
    });

    regexSearchButton.addEventListener('click', () => {
        regexSearchEnabled = !regexSearchEnabled;
        regexSearchButton.setAttribute('aria-pressed', String(regexSearchEnabled));
        showSearchResults(searchInput.value, searchPopup, searchInput, regexSearchEnabled);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchPopup.classList.remove('open');
            searchInput.setAttribute('aria-expanded', 'false');
            searchInput.blur();
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#search')) {
            searchPopup.classList.remove('open');
            searchInput.setAttribute('aria-expanded', 'false');
        }
    });


    const openBtn = document.getElementById('open_button');
    openBtn.addEventListener('click', () => {
        let btn = document.createElement('input');
        btn.type = 'file';
        btn.onchange = (e) => {
            openBtn.style.display = 'none';
            loadFiles(e.target.files);
        };
        btn.click();
    });

    const dz = document.getElementById('panel');
    dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        dz.classList.add('dropready');
    });

    dz.addEventListener('dragleave', (e) => {
        dz.classList.remove('dropready');
    });

    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        loadFiles(e.dataTransfer.files);
    });

    const fetchButton = document.getElementById('fetch_button');

    fetchButton.addEventListener('click', () => {

        const lang = document.getElementById('lang').value;
        const branch = document.getElementById('branch').value;

        if (!lang || !branch) {

            alert('Select one of languages and one of branches.');
            return;

        }

        const filename = 'qgis_' + lang + '.ts';
        const url = 'https://raw.githubusercontent.com/qgis/QGIS/' + branch + '/i18n/' + filename;
        sourceBranch = branch;

        document.getElementById('panel').style.display = 'none';

        setStatusText('Fetching ' + filename + ' in "' + branch + '" branch from GitHub...');

        // download progress:
        // https://developer.mozilla.org/ja/docs/Web/API/Streams_API/Using_readable_streams

        fetch(url)
        .then((res) => {

            const total = parseInt(res.headers.get('content-length'), 10);
            let loaded = 0;

            const reader = res.body.getReader();
            return new ReadableStream({
                start(controller) {
                    return pump();
                    function pump() {
                        return reader.read().then(({done, value}) => {

                            if (done) {
                                controller.close();
                                setProgress(1);
                                return;
                            }

                            loaded += value.byteLength;
                            setProgress(loaded / total);

                            controller.enqueue(value);
                            return pump();
                        });
                    }
                }
            });
        })
        .then((stream) => new Response(stream))
        .then((res) => res.text())
        .then((xmlStr) => {

            setStatusText('Checking translations...');
            setProgress(0);

            setTimeout(() => {

                const v = new Checker(setProgress);
                v.branch = branch;
                v.filename = filename;

                v.load(xmlStr);
                v.check().then(() => {

                    writeResult(v);
                    setStatusText('Completed!', 2000);

                });

            }, 0);

        }).catch((e) => console.error(e));

    });

    const url = new URL(window.location.href),
          params = url.searchParams;

    if (params.has('useTokenizer')) {

        loadTokenizer();

    }

});


function showSearchResults(query, popup, input, regexSearchEnabled) {

    popup.replaceChildren();

    const term = query.trim().toLocaleLowerCase();
    if (!term) {
        popup.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        return;
    }

    let matches;
    if (regexSearchEnabled) {
        let pattern;
        try {
            pattern = new RegExp(query, 'i');
        }
        catch (error) {
            const invalid = document.createElement('div');
            invalid.className = 'search-empty error';
            invalid.textContent = `Invalid regular expression: ${error.message}`;
            popup.appendChild(invalid);
            popup.classList.add('open');
            input.setAttribute('aria-expanded', 'true');
            return;
        }

        matches = searchableMessages.filter((message) =>
            pattern.test(message.source) || pattern.test(message.translation)
        );
    }
    else {
        matches = searchableMessages.filter((message) =>
            message.source.toLocaleLowerCase().includes(term) ||
            message.translation.toLocaleLowerCase().includes(term)
        );
    }

    if (!matches.length) {
        const empty = document.createElement('div');
        empty.className = 'search-empty';
        empty.textContent = 'No matching messages.';
        popup.appendChild(empty);
    }
    else {
        for (const message of matches.slice(0, MAX_RESULTS)) {
            const item = document.createElement('div');
            item.className = 'search-result';
            item.setAttribute('role', 'option');

            const source = document.createElement('div');
            source.textContent = message.source;

            const translation = document.createElement('div');
            translation.textContent = message.translation;

            const location_link = (message.location) ? '<a href="' + makeUrl(message.location.filename, message.location.line) + '" target="_blank">' + message.location.filename + '</a>' : '';

            const details = document.createElement('div');
            details.innerHTML = [message.context, location_link].filter(Boolean).join(' - ');

            item.append(source, translation, details);
            popup.appendChild(item);
        }

        if (matches.length > MAX_RESULTS) {
            const more = document.createElement('div');
            more.className = 'search-more';
            more.textContent = `Showing ${MAX_RESULTS} of ${matches.length} matches.`;
            popup.appendChild(more);
        }
    }

    popup.classList.add('open');
    input.setAttribute('aria-expanded', 'true');

}


function makeUrl(filepath, line=undefined, branch=undefined) {

    branch = branch || sourceBranch;

    const url = 'https://github.com/qgis/QGIS/blob/' + branch + filepath.replace('../', '/');
    // https://github.com/qgis/QGIS/blob/master/src/core/qgis.cpp#L178
    // https://github.dev/qgis/QGIS/blob/master/src/core/qgis.cpp#L178

    return (line === null || line === undefined) ? url : url + '#L' + line;

}


function writeResult(checker) {

    searchableMessages.push(...checker.messages);

    const escape = function (str) {

        return str.replaceAll('&', '&amp').replaceAll('<', '&lt').replaceAll('>', '&gt;');

    };

    // grouped by error/warning message
    const htmlGroupdedByMsg = function (res_list) {

        let html = '';
        let groups = {};

        for (let r of res_list) {

            if (groups[r.msg] === undefined) {

                groups[r.msg] = [r];

            }
            else {

                groups[r.msg].push(r);

            }

        }

        for (let [msg, items] of Object.entries(groups)) {

            html += '<h4>' + msg + ' <span class="count">(' + items.length + ')</span></h4>';
            html += '<ul>';
            for (let r of items) {

                html += '<li>';
                html += '<div>' + escape(r.source) + '</div>';
                html += '<div>' + escape(r.translation) + '</div>';
                html += '<div>[' + r.context + ']';
                if (r.location) {

                    html += ' <a href="' + makeUrl(r.location.filename, r.location.line, checker.branch) + '" target="_blank">' + r.location.filename + '</a>';

                }
                html += '</div></li>';

            }
            html += '</ul>';

        }

        return html;
    };

    let html = '',
        sourceTitle = checker.filename || 'Unknown';

    if (checker.branch) sourceTitle += ' in "' + checker.branch + '" branch';

    html += '<h2>' + sourceTitle + '</h2>';

    html += '<section class="stats">';
    html += '<h3>Statistics</h3>';
    html += '<ul>';
    html += ' <li>' + checker.stats.contextCount + ' contexts, ' + checker.stats.messageCount + ' messages, ' + checker.stats.untranslatedCount + ' untranslated</li>';
    html += '</ul>';

    if (checker.stats.untranslatedCount) {

        html += '<div>Unfinished contexts:</div>';
        html += '<ul>';

        for (let context of checker.stats.contexts) {

            if (context.untranslatedCount) {

                html += ' <li>' + context.name + ': ' + context.untranslatedCount + ' of ' + context.messageCount + ' messages are untranslated.</li>';

            }

        }

        html += '</ul>';

    }

    html += '</section>';

    html += '<section class="error">';
    html += '<h3>Errors <span class="count">(' + checker.results[ERROR_LEVEL.ERROR].length + ')</span></h3>';
    html += htmlGroupdedByMsg(checker.results[ERROR_LEVEL.ERROR]);
    html += '</section>';

    html += '<section class="warning">';
    html += '<h3>Warnings <span class="count">(' + checker.results[ERROR_LEVEL.WARNING].length + ')</span></h3>';
    html += htmlGroupdedByMsg(checker.results[ERROR_LEVEL.WARNING]);
    html += '</section>';

    html += '<section class="untranslated">';
    html += '<h3>Untranslated <span class="count">(' + checker.results[ERROR_LEVEL.UNTRANSLATED].length + ')</span></h3>';
    html += htmlGroupdedByMsg(checker.results[ERROR_LEVEL.UNTRANSLATED]);
    html += '</section>';

    if (Object.keys(checker.token).length) {

        console.log('Unknown words:');
        console.log(checker.token);

        let words = [];
        for (let k of Object.keys(checker.token).sort()) {

            words.push('<div>' + k.replace('<', '&lt;').replace('>', '&gt') + ': ' + checker.token[k] + '</div>');

        }

        html += '<section class="token">';
        html += '<h3>Tokens</h3>';
        html += words.join('');
        html += '</section>';

    }

    document.getElementById('result').innerHTML += html;

}


function loadFiles(files) {

    document.getElementById('panel').style.display = 'none';

    let result = Promise.resolve();

    for (const file of files) {

        const v = new Checker(setProgress);

        result = result.then(() => {

            setStatusText('Checking translations in ' + file.name + '...');
            return v.loadFile(file);

        }).then(() => {

            return v.check();

        }).then(() => {

            v.filename = file.name;
            writeResult(v);

            setStatusText('Completed!', 2000);

        });

    }

}


function loadTokenizer() {

    return new Promise((resolve, reject) => {

        setStatusText('Loading tokenizer...');

        kuromoji.builder({dicPath: './lib/kuromoji.js/dict'}).build(function (err, tknzr) {

            if (err) {

                console.warn('Failed to load tokenizer.');

            }
            else {

                tokenizer = tknzr;

                setProgress(1);
                setStatusText('Tokenizer loaded.', 1000);

            }

            resolve();

        });

    });

}


class Checker {

    constructor(progressFunc) {

        this.CONTEXTS_PER_JOB = 10;

        this.results = [];
        this.results[ERROR_LEVEL.ERROR] = [];
        this.results[ERROR_LEVEL.WARNING] = [];
        this.results[ERROR_LEVEL.UNTRANSLATED] = [];

        this.stats = {
            contexts: [],
            contextCount: 0,
            messageCount: 0,
            untranslatedCount: 0
        };

        this.progressFunc = progressFunc;

        this.contexts = [];

        this.messages = [];

        this.token = {};
    }

    load(xmlStr) {

        return new Promise((resolve) => {

            this.parse(xmlStr);
            resolve();

        });

    }

    loadFile(file) {

        this.counter = 0;

        return new Promise((resolve) => {

            const reader = new FileReader();
            reader.readAsText(file);

            reader.onload = (e) => {

                this.parse(e.target.result);
                resolve();

            };

        });

    }

    parse(xmlStr) {

        const dom = new DOMParser().parseFromString(xmlStr, 'text/xml');
        const root = dom.documentElement;

        this.lang = root.getAttribute('language');
        this.contexts = [...root.children];     // HTMLCollection to array

        this.checkFunc = window['checkTranslation_' + this.lang] || window.checkTranslation;

    }

    check() {

        return new Promise((resolve) => {

            this._checkNextContext(resolve);

        });

    }

    _checkNextContext(resolve) {

        if (this.contexts.length == 0) {
            this.progressFunc(1);

            resolve();
            return;
        }

        const context = this.contexts.shift();

        const name = context.getElementsByTagName('name')[0].textContent;
        const messages = context.getElementsByTagName('message');
        const stats = {
            name: name,
            messageCount: messages.length,
            untranslatedCount: 0
        };

        for (const message of messages) {
            const source = message.getElementsByTagName('source')[0];
            const translation = message.getElementsByTagName('translation')[0];
            const location = message.getElementsByTagName('location')[0];
            const type = translation.getAttribute('type');

            const result = {
                context: name,
                source: source.textContent,
                translation: translation.textContent
            };

            if (type === null || type === 'unfinished') {
                this.messages.push(result);
            }

            if (location) {

                result.location = {

                    filename: location.getAttribute('filename'),
                    line: location.getAttribute('line')

                };

            }

            if (type === null) {
                // check a translated message

                const { errors, warnings } = this.checkFunc(source.textContent, translation.textContent);

                if (errors.length || warnings.length) {

                    if (errors.length) {

                        result.level = ERROR_LEVEL.ERROR;
                        result.msg = errors[0];

                    }
                    else {

                        result.level = ERROR_LEVEL.WARNING;
                        result.msg = warnings[0];

                    }

                    this.results[result.level].push(result);

                }

                if (tokenizer) {

                    var path = tokenizer.tokenize(translation.textContent);
                    var w;
                    for (let c of path) {
                        w = c.surface_form;
                        if (isNaN(w) && c.word_type == 'UNKNOWN') {
                            if (source.textContent.indexOf(w) == -1) {
                                this.token[w] = (this.token[w] === undefined) ? 1 : this.token[w] + 1;
                            }
                        }
                    }
                    console.log(path);

                }

            }
            else if (type == 'unfinished') {
                result.level = ERROR_LEVEL.UNTRANSLATED;
                result.msg = "Untranslated.";

                this.results[result.level].push(result);

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
