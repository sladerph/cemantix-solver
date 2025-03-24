let cemantix_game = document.querySelector("#cemantix");
let pedantix_game = document.querySelector("#pedantix");

let mode = cemantix_game == null ? 'pedantix' : 'cemantix';

const url = 'https://www.rimessolides.com/motscles.aspx?m=';
const morphology_url = 'https://www.cnrtl.fr/morphologie/';
const cors_api_url = 'http://localhost:8080/';

const sleep_after_failed_try = 200;
const max_sleep_delay = 10000;
const nb_failed_try_before_warning = 10;

async function main() {
    let quitOnError = false;

    // Needed to circumvent the check by the website, which disallows submitions made from scripts.
    // When writing this code, the website's current check is of the form "Error().stack.split('\n').length > 4 ?",
    // with 4 being the default value when interacting with the mouse/keyboard.
    Error.stackTraceLimit = 2; 

    if (mode == 'cemantix') {
        const first_words = ["eau", "air", "terre", "science", "humain", "politique", "religion", "histoire", "nature", "sport"];
        // const first_words = ["humain"];

        let entry_box = document.querySelector("#guess");
        let guess_button = document.querySelector("#guess-btn");
        let last_guess_field = document.querySelector("#guessed");
        let guesses_table = document.querySelector("#guesses");
        let story = document.querySelector(".story");
        let error_field = document.querySelector("#error");

        let story_tr = story.querySelectorAll("tr");
        let story_tr_array = [...story_tr];
        let min_temp = parseFloat(story_tr_array.find((el) => el.children[0].textContent == "1").children[2].textContent);
        
        if (isNaN(min_temp)) {
            console.error("ERROR, no min_temp", story, story_tr, min_temp);
            return;
        }
        // min_temp = 0;

        let tried = [];
        let top_words = [];
        let lexical_find = [];
        let words_to_try = [];
        let i = 0;
        let waiting = false;
        let game_won = false;
        let interval;
        let delay = 10;//200;
        let nb_top = 5;
        let last_try = null;

        let cleanFetchedWords = function(words) {
            let arr = [];
            for (let w of words) {
                if (w.includes(' ') || w.includes('-') || w.includes("'")) {
                    let fragments = [];
                    
                    let parts_a = w.split(' ');

                    for (let p_a of parts_a) {
                        if (p_a.includes('-') || p_a.includes("'")) {
                            let parts_b = p_a.split('-');

                            for (let p_b of parts_b) {
                                if (p_b.includes("'")) {
                                    let parts_c = p_b.split("'");

                                    for (let p_c of parts_c) {
                                        fragments.push(p_c);
                                    }
                                } else {
                                    fragments.push(p_b);
                                }
                            }
                        } else {
                            fragments.push(p_a);
                        }
                    }

                    for (let f of fragments) {
                        if (!arr.includes(f) && !tried.includes(f))
                            arr.push(f.trim());
                    }
                } else {
                    arr.push(w.trim());
                }
            }
            return arr;
        }

        let tryFirstWords = async function() {
            if (i >= first_words.length) {                
                console.log("START LIST DONE");

                top_words = await initLexicalFields(); // TODO: change variable name (not best words but all words).

                play();

                return;
            }
            let word = first_words[i];
            entry_box.value = word;
            
            let count = 0;
            while (entry_box.value != '' || 
                  (!isNaN(parseInt(last_guess_field.children[4].textContent)) && 
                  last_guess_field.children[2].style.visibility == '') || 
                  (last_guess_field.children[1].textContent != word.toLowerCase() && error_field.children.length == 0)
            ) {
                guess_button.click();
                count++;

                await sleep(sleep_after_failed_try);

                if (count % nb_failed_try_before_warning == 0) {
                    console.warn("Failed to try word", word, count, "times.");
                }
            }

            tried.push(word);
            i++;

            setTimeout(tryFirstWords, delay);
        }

        setTimeout(tryFirstWords, delay);

        let updateWordsScores = function(words, score, log = false) {
            if (score == null) {
                console.error(score, words);
            }
            for (let w of words) {
                let res = words_to_try.find((el)=>el.word == w);

                if (res != undefined) {
                    res.sum += score;
                    res.nb++;
                    // res.score = res.sum / (res.nb + 1);
                    res.score += score;
                } else {
                    words_to_try.push({
                        'word': w,
                        'score': score,
                        'sum': score,
                        'nb': 1,
                    });
                }
            }
            words_to_try.sort((a, b) => {
                if (a.score > b.score) return -1;
                else if (a.score < b.score) return 1;
                else return 0;
            });
            if (log) {
                // console.log("Words to try :", JSON.stringify(words_to_try));
                console.log("Words to try :", JSON.stringify(words_to_try.slice(0, 10)));
            }
        }
        let initLexicalFields = async function() {
            let res = [];
            let s = 1, e = guesses_table.children.length;
            
            for (let i = s; i < e; i++) {
                let entry = guesses_table.children[i];
                let score = parseFloat(entry.children[2].textContent);
                let word  = entry.children[1].textContent;

                if (!tried.includes(word)) tried.push(word);
                
                console.log("Init Lexical field :", word);
                let words = await fetchLexcicalField(word, tried);

                words = cleanFetchedWords(words);

                res.push({
                    'word': word,
                    'score': score,
                    'lexical_field': words,
                });

                if (isNaN(parseInt(entry.children[4].textContent))) {
                    score -= min_temp;
                }

                updateWordsScores(words, score);
            }
            if (res.length == 0 || parseFloat(last_guess_field.children[2].textContent) > res[0].score) { // Real first.
                let score = parseFloat(last_guess_field.children[2].textContent);
                
                let words = await fetchLexcicalField(last_guess_field.children[1].textContent, tried);

                words = cleanFetchedWords(words);

                res.splice(0, 0, {
                    'word': last_guess_field.children[1].textContent,
                    'score': score,
                    'lexical_field': words,
                });

                if (isNaN(parseInt(last_guess_field.children[4].textContent))) {
                    score -= min_temp;
                }

                updateWordsScores(words, score);
            }
            // console.log("Words to try :", JSON.stringify(words_to_try));
            console.log("Words to try :", JSON.stringify(words_to_try.slice(0, 10)));
            return res;
        }
        let play = async function() {
            if (!waiting) {
                if (words_to_try.length == 0) {
                    console.error("ERROR, no word to try !");
                    return;
                }
                
                let word = words_to_try.shift(); // Pop first element.
                console.log("Word :", word.word);
                console.log("Score : ", word.score);
                console.log("Words to try length :", words_to_try.length);

                word = word.word;

                last_try = word;
                waiting = true;
                tried.push(word);
                entry_box.value = word;
                
                let count = 0;
                while (entry_box.value != '' || 
                       (last_guess_field.children[1].textContent != word.toLowerCase() && error_field.children.length == 0)
                ) {
                    guess_button.click();
                    count++;

                    await sleep(sleep_after_failed_try);

                    if (count % nb_failed_try_before_warning == 0) {
                        console.warn("Failed to try word", word, count, "times.");
                    }
                }

                setTimeout(play, delay);
            } else {
                // Wait for animation to finish if there is one.
                let position = parseInt(last_guess_field.children[4].textContent);
                if (isNaN(position) || last_guess_field.children[2].style.visibility != '') {
                    waiting = false;
                }
                if (position == 1000 || top_words.find((el) => el.score == 100)) {
                    game_won = true;
                    
                    console.log("%cGAME WON !", "color: green; font-weight: bold; font-size: 32px");

                    return;
                }
                if (last_guess_field.children[1].textContent == last_try) {
                    let words = await fetchLexcicalField(last_try, tried);

                    words = cleanFetchedWords(words);

                    let score = parseFloat(last_guess_field.children[2].textContent);

                    top_words.push({
                        'word': last_try,
                        'score': score,
                        'lexical_field': words,
                    });

                    if (isNaN(parseInt(last_guess_field.children[4].textContent))) {
                        score -= min_temp;
                    }

                    updateWordsScores(words, score, true);
                }
                setTimeout(play, delay);
                return;
            }
        }
    } else {
        // TODO.
        console.log("not in this version");
    }

    async function fetchAsync (url) {
        let response = await fetch(url);
        //let data = await response.json();
        let data = await response.text();
        return data;
    }

    async function fetchLexcicalField(word, tried) {
        let words = [];
        const url = 'https://www.rimessolides.com/motscles.aspx?m=';
        // const url = 'https://www.textfocus.net/synonyme/';
        const cors_api_url = 'http://localhost:8080/';
        let mode_url_bis = false; // True if main site is down.

        let data = await fetchAsync(cors_api_url + url + word);

        let parser = new DOMParser();
        let doc = parser.parseFromString(data, "text/html");

        if (!mode_url_bis) {
            arr = doc.querySelectorAll(".motcle");
            for (let el of arr) {
                let w = el.textContent;
                // if (w.includes(' ') || w.includes("'")) continue;
                if (w.includes(',')) w = w.replaceAll(",", "");
                if (w.includes(';')) w = w.replaceAll(";", "");
                if (tried.includes(w)) continue;
                words.push(w);
            }
        } else {
            arr = [...doc.querySelectorAll(".row.mb45")[3].querySelectorAll("br")];
            for (let el of arr) {
                let w = el.previousSibling.textContent.trim();
                // if (w.includes(' ') || w.includes("'")) continue;
                if (w.includes(',')) w = w.replaceAll(",", "");
                if (w.includes(';')) w = w.replaceAll(";", "");
                if (tried.includes(w)) continue;
                words.push(w);
            }
        }


        return words;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

main();