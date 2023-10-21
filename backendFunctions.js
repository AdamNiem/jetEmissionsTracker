function generateId(length, set = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"){
    let id = "";

    let x;
    for(x = 0; x < length; x++){
        id += set[Math.floor(Math.random() * set.length)];
    }

    return id;
}

function generateName(){
    let adjectives = ["Saucy", "Scarlet", "Sour", "Sweet", "Sneaky", "Red", "Purple", "Agile", "Clever", "Brave", "Fast"];
    let nouns = ["Monke", "Banana", "Panda", "Kettle", "Apple", "Fox", "Coyote", "Rabbit", "Bunny", "Whale", "Doormat", "Bamboo", "Carrot", "Tomato", "Kale", "Pasta", "Cookie",];

    return adjectives[Math.floor(Math.random() * adjectives.length)] + nouns[Math.floor(Math.random() * nouns.length)]
}

module.exports = {
    generateId,
    generateName
};