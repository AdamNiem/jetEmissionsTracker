
let socket = io();  
let gameCode = "";  
let playersDice = [];

let numPlayersInRoom = 0;

//User Emitted Stuff

//createGame() is not needed here as server creates room upon player connecting
function createGame(){
    //socket.emit("start");
}

function startGameRequest(){
    socket.emit("startGame", gameCode);
};

function joinGame(gameCode){
    //Sends a joinGame request and will change the screen if the request is successful
    socket.emit("joinGame", gameCode, (response)=>{
        //response returns true from the server if client successfully joined the room/game
        if(response){console.log("room joined");}
    });
}

function leaveGame(){
    socket.emit("leaveGame");
}

//Stuff to do when it gets a message from the server
socket.on("gameCode", (code) => {
    //document.getElementById("gameCode").textContent = "Game Code: " + code;
    gameCode = code;
    roomInput.value = gameCode;
    console.log("gameCode");
});

socket.on("hostInfo", (code) => {
    //document.getElementById("gameCode").textContent = "Game Code: " + code;
    //gameCode = code;
        console.log("hostinfo");

});

socket.on("roomInfo", (res) => {
    //document.getElementById("gameCode").textContent = "Game Code: " + code;
    //gameCode = code;
    console.log("roominfo");
    console.log(res);

    numPlayersInRoom = res.numClients;
    adjustAvatars(numPlayersInRoom);
});

socket.on("gameStart", (code) => {
    console.log("gameStart");
});

socket.on("diceNums", (res) => {
    playersDice = res;

    adjustDice(playersDice);
});

socket.on("hello", (response) => {
    console.log("hello world!");
});

socket.on("test", (res) => {
    console.log(res);
});

socket.on("error", (res) => {
    alert(res);
});

//event handlers so that buttons and inputs work
let roomInput = document.getElementById("roomInput");
let roomForm = document.getElementById("roomForm");

let roomButton = document.getElementById("roomButton");
let roomButtonReady = document.getElementById("roomButtonReady");

roomForm.onsubmit = function(e){
    e.preventDefault();
}

roomButton.onclick = function(){
    joinGame(roomInput.value);
};

roomButtonReady.onclick = function(){
    startGameRequest(gameCode);
};

let gameTable = document.getElementById("gameTable");
let gameTableHighlighter = document.getElementById("gameTableHighlighter");

//Draw amount of avatars for amount of players
function adjustAvatars(numPlayers){
    //get number of avatar images currently
    let avatars = gameTable.getElementsByTagName("img");
    let numAvatars = avatars.length;

    console.log(numAvatars);

    //first removes all avatars
    let x;
    for(x = 0; x < numAvatars; x++){
        avatars[0].remove();
    }

    //then adds the amount needed
    let img;
    for(x = 0; x < numPlayers; x++){
        img = document.createElement("img");
        img.id = "gameTableImage " + x;
        img.src = "https://static.thenounproject.com/png/5100711-200.png";
        img.classList.add("item");
        gameTable.appendChild(img);
    }
}

let diceBar = document.getElementById("diceBar");

//Change the dice to match what the server sends the client as their dice
//need to add feature to adjsut dice to change number of dice as well
function adjustDice(playerDice){
    let die = diceBar.getElementsByTagName("i");
    let i = 0;
    for(i; i < die.length; i++){
        let dieClass = "";
        switch(playerDice[i]){
            case 1:
                dieClass = "fa-dice-one";
            break;
            case 2:
                dieClass = "fa-dice-two";
            break;
            case 3:
                dieClass = "fa-dice-three";
            break;
            case 4:
                dieClass = "fa-dice-four";
            break;
            case 5:
                dieClass = "fa-dice-five";
            break;
            case 6:
                dieClass = "fa-dice-six";
            break;
        }
        die.classList.replace("fa-dice-one", dieClass);
    }
}

