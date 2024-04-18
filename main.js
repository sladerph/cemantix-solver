let cemantix_game = document.querySelector("#cemantix-game");
let pedantix_game = document.querySelector("#pedantix-game");

let mode = cemantix_game.style.display == '' ? 'cemantix' : 'pedantix'

const url = 'https://www.rimessolides.com/motscles.aspx?m=';
const cors_api_url = 'http://localhost:8080/';

function main() {
    if (mode == 'cemantix') {
        const first_words = ["eau", "air", "terre", "science", "humain", "politique", "religion", "histoire", "animal", "sport"];
        
        let entry_box = document.querySelector("#cemantix-guess");
        let guess_button = document.querySelector("#cemantix-guess-btn");
        let last_guess_field = document.querySelector("#cemantix-guessed");
        let guesses_table = document.querySelector("#cemantix-guesses");

        let tried = [];
        let top_words = [];
        let lexical_find = [];
        let words_to_try = [];
        let i = 0;
        let waiting = false;
        let game_won = false;
        let interval;
        let delay = 200;
        let nb_top = 5;
        let last_try = null;

        interval = setInterval(async ()=>{
            if (i >= first_words.length && !waiting) {
                clearInterval(interval);
                
                console.log("START LIST DONE");
                waiting = false;

                top_words = getTopWords();
                lexical_find = await getWordsOfLexicalField();
                words_to_try = getWordsToTry();
                play();

                return;
            }
            if (waiting) {
                let position = parseInt(last_guess_field.children[4].textContent);
                if (isNaN(position) || last_guess_field.children[2].style.visibility != '') {
                    waiting = false;
                }
                // console.log(waiting);
                return;
            }
            let word = first_words[i];
            entry_box.value = word;
            guess_button.click();
            tried.push(word);
            waiting = true;
            i++;
        }, delay);

        let getTopWords = function() {
            let res = [];
            let s = 1, e = s + nb_top;
            if (top_words.length > 0) {
                // console.log(top_words);
                if (parseFloat(last_guess_field.children[2].textContent) > top_words[0].score) {
                    e--;
                    res.push({
                        'word': last_guess_field.children[1].textContent,
                        'score': parseFloat(last_guess_field.children[2].textContent),
                    });
                }
            } // TODO : Check case where length == 0 but top word is the last tried.
            for (let i = s; i < e; i++) {
                let entry = guesses_table.children[i];
                res.push({
                    'word': entry.children[1].textContent,
                    'score': parseFloat(entry.children[2].textContent),
                    });
            }
            return res;
        }
        let getWordsOfLexicalField = async function() {
            let res = [];
            for (let i = 0; i < top_words.length; i++) {
                let words = [];
                let data = await fetchAsync(cors_api_url + url + top_words[i].word);

                let parser = new DOMParser();
                let doc = parser.parseFromString(data, "text/html");
                arr = doc.querySelectorAll(".motcle");
                for (let el of arr) {
                    let w = el.textContent;
                    if (w.includes(' ') || w.includes("'")) continue;
                    if (w.includes(',')) w = w.slice(0, -1);
                    words.push(w);
                }
                res.push(words);
            }
            return res;
        }
        let updateLexicalField = async function(old_top) {
            let word = last_guess_field.children[1].textContent;
            let score = parseFloat(last_guess_field.children[2].textContent);
            for (let i = 0; i < old_top.length; i++) {
                if (old_top[i].score < score) {
                    top_words.splice(i, 0, {
                        'word': word,
                        'score': score,
                    });
                    top_words.pop();

                    let words = [];
                    let data = await fetchAsync(cors_api_url + url + word);

                    let parser = new DOMParser();
                    let doc = parser.parseFromString(data, "text/html");
                    arr = doc.querySelectorAll(".motcle");
                    for (let el of arr) {
                        let w = el.textContent;
                        if (w.includes(' ') || w.includes("'")) continue;
                        if (w.includes(',')) w = w.slice(0, -1);
                        words.push(w);
                    }

                    lexical_find.splice(i, 0, words);
                    lexical_find.pop();
                    break;
                }
            }
            return lexical_find;
        }
        let getWordsToTry = function() {
            let curr_comp = [];
            for (let i = lexical_find.length - 1; i > 0; i--) {
                if (curr_comp.length == 0) { // Compare i with i - 1.
                    let arr = [];

                    for (let a of lexical_find[i]) {
                        if (arr.includes(a) || tried.includes(a)) continue;
                        for (let b of lexical_find[i - 1]) {
                            if (arr.includes(b) || tried.includes(b)) continue;
                            if (a == b) {
                                arr.push(a);
                                break;
                            }
                        }
                    }
                    curr_comp = arr;
                    // console.log(curr_comp);
                } else { // Compare curr_comp with i - 1.
                    let arr = [];

                    for (let a of curr_comp) {
                        if (arr.includes(a) || tried.includes(a)) continue;
                        for (let b of lexical_find[i - 1]) {
                            if (arr.includes(b) || tried.includes(b)) continue;
                            if (a == b) {
                                arr.push(a);
                                break;
                            }
                        }
                    }
                    curr_comp = arr;
                    // console.log(curr_comp);
                }
            }
            let i = 0;
            
            while (curr_comp.length == 0 && i < lexical_find.length) {
                curr_comp = lexical_find[i];
                // console.log("SW", curr_comp);
                i++;
                
                let arr = [];
                for (let w of curr_comp) {
                // for (let j = 0; j < curr_comp.length; j++) {
                    // let w = curr_comp[j];
                    if (!tried.includes(w)) arr.push(w);
                }
                curr_comp = arr;
                // console.log("EW", curr_comp);
            }
            if (curr_comp.length == 0) {
                console.error("ERROR, no new word found in the lexical field of the five first words !");
            }
            console.log("Words to try :", curr_comp);
            return curr_comp;
        }
        let play = async function() {
            if (!waiting) {
                if (last_try != null) {
                    let ok = true;

                    if (parseFloat(last_guess_field.children[2].textContent) > top_words[top_words.length - 1].score) ok = false;

                    if (words_to_try.length == 0 && ok) {
                        words_to_try = getWordsToTry();
                        // console.log("Word to try OLD BEST", words_to_try);
                    }
                    if (!ok) {
                        // Need to redo the top five and lexical field.
                        // top_words = getTopWords();
                        lexical_find = await updateLexicalField(top_words);
                        // lexical_find = await getWordsOfLexicalField();
                        words_to_try = getWordsToTry();
                        // console.log(top_words);
                        // console.log(lexical_find);
                    }
                }
                if (words_to_try.length == 0) {
                    console.error("ERROR, no word to try !");
                    nb_top++;
                    console.log("New nb_top :", nb_top);
                    top_words = getTopWords();
                    lexical_find = await getWordsOfLexicalField();
                    words_to_try = getWordsToTry();
                    setTimeout(play, delay);
                    return;
                }
                // // Try first word.
                // let word = words_to_try.shift(); // Pop first element.

                let best_ind = 0;
                let best_sim = 0;
                for (let ind = 0; ind < words_to_try.length; ind++) {
                    let w = words_to_try[ind];
                    // let sim = similarity(top_words[0].word, w);
                    let sim = 0;
                    for (let j = 0; j < Math.min(w.length, top_words[0].word.length); j++) {
                        if (w[j] == top_words[0].word[j]) sim++;
                        else break;
                    }

                    if (sim >= 3 && sim > best_sim) {
                    // if (sim >= 0.5 && sim > best_sim) {
                        best_sim = sim;
                        best_ind = ind;
                    }
                }
                console.log(best_sim);
                let word = words_to_try.splice(best_ind, 1);
                word = word[0];

                // console.log(word);
                entry_box.value = word;
                last_try = word;
                waiting = true;
                guess_button.click();
                tried.push(word);
                setTimeout(play, delay);
            } else {
                // Wait for animation to finish if there is one.
                let position = parseInt(last_guess_field.children[4].textContent);
                if (isNaN(position) || last_guess_field.children[2].style.visibility != '') {
                    waiting = false;
                }
                if (position == 1000 || top_words.find((el) => el.score == 100)) {
                    game_won = true;
                    
                    console.clear();
                    console.log("%cGAME WON !", "color: green; font-weight: bold; font-size: 32px");

                    return;
                }
                setTimeout(play, delay);
                return;
            }
        }
    } else { // Mode pedantix
        const first_words = ["il", "et", "ou", "le", "de", "se", "ce", "son", "en", "à", "par", "pour", "sans", "avec", "y", "humain", 
                             "science", "nature", "animal", "nord", "sud", "ouest", "être", "avoir", "faire", "pouvoir", "politique"];
        
        let entry_box = document.querySelector("#pedantix-guess");
        let guess_button = document.querySelector("#pedantix-guess-btn");
        let guesses_table = document.querySelector("#pedantix-guesses");
        let title = document.querySelector("#wiki h2");
        let article = document.querySelector("#article");
    }

    async function fetchAsync (url) {
        let response = await fetch(url);
        //let data = await response.json();
        let data = await response.text();
        return data;
    }
}

main();