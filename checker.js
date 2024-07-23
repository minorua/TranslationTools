const ERROR_LEVEL = {
    WARNING: 1,
    ERROR: 2
};

const LANG_LIST = [
    'ar', 'az', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'en_US', 'es', 'et', 'eu', 'fi', 'fr',
    'gl', 'hu', 'is', 'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl', 'pl', 'pt_BR', 'pt_PT', 'ro',
    'ru', 'sc', 'sk', 'sv', 'tr', 'uk', 'vi', 'zh-Hans', 'zh-Hant'
];

var setProgress, setStatusText;
var tokenizer;

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

    const dz = document.getElementById('open_button');

    dz.addEventListener('click', () => {
        let btn = document.createElement('input');
        btn.type = 'file';
        btn.onchange = (e) => {
            dz.style.display = 'none';
            loadFiles(e.target.files);
        };
        btn.click();
    });

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

        const lang = document.getElementById('lang').value,
              branch = document.getElementById('branch').value;

        if (!lang || !branch) {

            alert('Select one of languages and one of branches.');
            return;

        }

        document.getElementById('panel').style.display = 'none';

        const filename = 'qgis_' + lang + '.ts';

        setStatusText('Fetching ' + filename + ' in "' + branch + '" branch from GitHub...');

        const url = 'https://raw.githubusercontent.com/qgis/QGIS/' + branch + '/i18n/' + filename;

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


function writeResult(checker) {

    const branch = checker.branch || 'master';

    const escape = function (str) {

        return str.replaceAll('&', '&amp').replaceAll('<', '&lt').replaceAll('>', '&gt;');

    };

    const makeUrl = function (filename, line) {

        const url = 'https://github.com/qgis/QGIS/blob/' + branch + filename.replace('../', '/');
        // https://github.com/qgis/QGIS/blob/master/src/core/qgis.cpp#L178
        // https://github.dev/qgis/QGIS/blob/master/src/core/qgis.cpp#L178

        return (line === undefined) ? url : url + '#L' + line;

    }

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

                    html += ' <a href="' + makeUrl(r.location.filename, r.location.line) + '" target="_blank">' + r.location.filename + '</a>';

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

        this.stats = {
            contexts: [],
            contextCount: 0,
            messageCount: 0,
            untranslatedCount: 0
        };

        this.progressFunc = progressFunc;

        this.contexts = [];

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

        let source, translation, location, type, result;
        let errMsgs, warnMsgs;

        for (const message of messages) {
            source = message.getElementsByTagName('source')[0];
            translation = message.getElementsByTagName('translation')[0];
            location = message.getElementsByTagName('location')[0];
            type = translation.getAttribute('type');
            if (type === null) {

                [errMsgs, warnMsgs] = this.checkFunc(source.textContent, translation.textContent);

                if (errMsgs.length || warnMsgs.length) {

                    result = {
                        context: name,
                        source: source.textContent,
                        translation: translation.textContent
                    };

                    if (errMsgs.length) {

                        result.level = ERROR_LEVEL.ERROR;
                        result.msg = errMsgs[0];

                    }
                    else {

                        result.level = ERROR_LEVEL.WARNING;
                        result.msg = warnMsgs[0];

                    }

                    if (location) {

                        result.location = {

                            filename: location.getAttribute('filename'),
                            line: location.getAttribute('line')

                        };

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
