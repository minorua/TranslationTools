
const ph1 = `{\S*?}`;
const ph2 = `%[0-9a-z]`;



function checkTranslation(s, t) {

    const errMsgs = [], warnMsgs = [];
    let a, b;

    // Test 1
    a = [...s.matchAll(ph1)].sort().toString();

    if (a) {

        b = [...t.matchAll(ph1)].sort().toString();

        if (new Set(a.split(',')).difference(new Set(b.split(','))).size) {

            errMsgs.push('There are missing placeholder(s): {}');

        }
        else if (a != b) {

            warnMsgs.push("The number of placeholders doesn't match: {}");

        }

    }

    // Test 2
    a = [...s.matchAll(ph2)].sort().toString();

    if (a) {

        b = [...t.matchAll(ph2)].sort().toString();

        if (new Set(a.split(',')).difference(new Set(b.split(','))).size) {

            errMsgs.push('There are missing placeholder(s): %');

        }
        else if (a != b) {

            warnMsgs.push("The number of placeholders doesn't match: %");

        }

    }

    if (t.trim() == '' && s.trim() != '') {

        warnMsgs.push('Translation is empty.');

    }

    if (s.slice(-3) == '...') {

        if (t.slice(-3) != '...' && t.slice(-1) != '…') {

            warnMsgs.push('There are missing three dots (...) at the end.');

        }

    }

    return [errMsgs, warnMsgs];

}


function checkTranslation_ja(s, t) {

    const [errMsgs, warnMsgs] = checkTranslation(s, t);

    if (s.slice(-1) == '…' && t.slice(-3) != '...') {

        warnMsgs.push('There are missing 3 dots at the end (must be 3 dots).');

    }

    if (t.indexOf('…') != -1) {

        warnMsgs.push('There is an ellipsis character (…).');

    }

    if (s.indexOf('....') == -1 && s.indexOf('……') == -1 && t.indexOf('....') != -1) {

        warnMsgs.push('There is unexpected four dots (....).');

    }

    return [errMsgs, warnMsgs];

}
