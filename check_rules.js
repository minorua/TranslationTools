
const bracePlaceholderPattern = `{\S*?}`;
const percentPlaceholderPattern = `%[0-9a-z]`;

const requiredTerms_ja = { "API": "API" };


function checkTranslation(s, t) {

    const errors = [], warnings = [];
    let a, b;

    a = [...s.matchAll(bracePlaceholderPattern)].sort().toString();

    if (a) {

        b = [...t.matchAll(bracePlaceholderPattern)].sort().toString();

        if (new Set(a.split(',')).difference(new Set(b.split(','))).size) {

            errors.push('There are missing placeholder(s): {}');

        }
        else if (a != b) {

            warnings.push("The number of placeholders doesn't match: {}");

        }

    }

    a = [...s.matchAll(percentPlaceholderPattern)].sort().toString();

    if (a) {

        b = [...t.matchAll(percentPlaceholderPattern)].sort().toString();

        if (new Set(a.split(',')).difference(new Set(b.split(','))).size) {

            errors.push('There are missing placeholder(s): %');

        }
        else if (a != b) {

            warnings.push("The number of placeholders doesn't match: %");

        }

    }

    if (t.trim() == '' && s.trim() != '') {

        warnings.push('Translation is empty.');

    }

    if (s.slice(-3) == '...') {

        if (t.slice(-3) != '...' && t.slice(-1) != '…') {

            warnings.push('There are missing three dots (...) at the end.');

        }

    }

    return { errors, warnings };

}


function checkTranslation_ja(s, t) {

    const { errors, warnings } = checkTranslation(s, t);

    for (const [sourceTerm, translationTerm] of Object.entries(requiredTerms_ja)) {

        const sourcePattern = new RegExp(`\\b${sourceTerm}\\b`, "i");

        if (sourcePattern.test(s) && !t.includes(translationTerm)) {

            warnings.push(`There is a missing required term: ${translationTerm}.`);

        }

    }

    if (s.slice(-1) == '…' && t.slice(-3) != '...') {

        warnings.push('There are missing 3 dots at the end (must be 3 dots).');

    }

    if (t.indexOf('…') != -1) {

        warnings.push('There is an ellipsis character (…).');

    }

    if (s.indexOf('....') == -1 && s.indexOf('……') == -1 && t.indexOf('....') != -1) {

        warnings.push('There is unexpected four dots (....).');

    }

    return { errors, warnings };

}
