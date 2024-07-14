
const ph1 = `%[0-9a-z]`;
const ph2 = `{.*?}`;

function checkTranslation(s, t) {

    let msg = '';

    // critical errors
    if ([...s.matchAll(ph1)].sort().toString() != [...t.matchAll(ph1)].sort().toString()) msg = 'placeholders unmatched (%)';
    else if ([...s.matchAll(ph2)].sort().toString() != [...t.matchAll(ph2)].sort().toString()) msg = 'placeholders unmatched ({})';

    if (msg) {

        return {
            level: ERROR_LEVEL.CRITICAL,
            msg: msg
        };

    }

    // warnings
    if (t.trim() == '' && s.trim() != '') msg = 'empty translation';
    else if (s.slice(-3) == '...' && t.slice(-3) != '...') msg = 'missing ... (3 dots)';

    if (msg) {

        return {
            level: ERROR_LEVEL.WARNING,
            msg: msg
        };

    }

    return null;
}


function checkTranslation_ja(s, t) {

    let result = checkTranslation(s, t);
    if (result) return result;

    let msg = '';

    if (s.slice(-1) == '…' && t.slice(-3) != '...') msg = 'missing ... (must be 3 dots)';
    else if (t.indexOf('…') != -1) msg = 'ellipsis used';
    else if (s.indexOf('....') == -1 && s.indexOf('……') == -1 && t.indexOf('....') != -1) msg = '.... (4 dots) used';

    if (tokenizer) {

        var path = tokenizer.tokenize(t);
        var w;
        for (let c of path) {
            w = c.surface_form;
            if (isNaN(w) && c.word_type == 'UNKNOWN') {
                if (s.indexOf(w) == -1) {
                    token[w] = (token[w] === undefined) ? 1 : token[w] + 1;
                }
            }
        }
        console.log(path);

    }

    if (msg) {

        return {
            level: ERROR_LEVEL.WARNING,
            msg: msg
        };

    }

    return null;
}


/*
function checkTranslation_??(s, t) {

    let msg = '';

    // critical errors


    if (msg) {

        return {
            level: ERROR_LEVEL.CRITICAL,
            msg: msg
        };

    }

    let result = checkTranslation(s, t);
    if (result) return result;

    // warnings

    if (msg) {

        return {
            level: ERROR_LEVEL.WARNING,
            msg: msg
        };

    }

    return null;
}
*/
