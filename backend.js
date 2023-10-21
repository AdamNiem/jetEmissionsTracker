//Notes: in future put backend stuff in own folder and maybe separate node modules for frontend and backend

const express = require('express');
const app = express();
app.disable('x-powered-by'); //helps for opsec
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const crypto = require('crypto');

//Communication stuff
app.get('/', (req, res) => { 
    res.sendFile(__dirname + '/frontend/index.html');
});

//app.use('/static', express.static(__dirname + '/' ) ); 
app.use(express.static(__dirname + '/frontend' ) );


//io stuff
const usernames = {}; 
const playerIdToIndex = {};
const rooms = {};
//Records information about clients such as their controller input 
const clients = {};
//Records which room the clients are in
const clientRooms = {};

//defines basic functions to use from backendFunctions.js file
const functions = require('./backendFunctions.js');
const generateName = functions.generateName;
const generateId = functions.generateId;

//some settings for the rooms
const playerCap = 8;
const playersNeeded = 2;

//Gets info that will be sent to joining players
function getRoomInfo(roomName){
                
    //Gives some room info to the player that just joined
    try{
        if(typeof rooms[roomName] === "undefined"){
            throw "roomName room is undefined";
        }
    }
    catch(err){
        return;
    }

    let roomInfo = {
        numClients:rooms[roomName].capacity, //redundant with capacity it seems
        playerPosToName:[],
        playerReadyList:[],
        maxCapacity:rooms[roomName].maxCapacity,//max amount of players that can be in that room
        capacity:rooms[roomName].capacity,
        capacityNeeded:rooms[roomName].capacityNeeded,//The number of players needed to start the game
    };

    let x;
    let room = rooms[roomName];
    let clientNames = Object.keys(room.clients);
    let client = room.clients[clientNames[0]];

    //loops through and gives the player the number of clients and how many are ready-up-ed
    for(x = 0; x < roomInfo.numClients; x++){
        client = room.clients[clientNames[x]];
        roomInfo.playerReadyList[client.number] = client.ready;
        roomInfo.playerPosToName[client.number] = clients[clientNames[x]].username;
    }

    return roomInfo;
}

//creates a room for that socket/client
function createRoom(socket, io){
    //If the client is not a part of a room then make a room.
    let roomName; 
    if(typeof clients[socket.id].room === "undefined"){

        roomName = generateId(6);
        clientRooms[socket.id] = roomName; //Records what room the player is in
        clients[socket.id].room = roomName;

        //The player who created the game automatically joins it
        socket.join(roomName);
        io.to(socket.id).emit("gameCode", roomName);

        //Init the game by making a room object with a ton of room specific info
        rooms[roomName] = {};
        //Needed for the ready up stuff
        rooms[roomName].clients = {};
        rooms[roomName].clients[socket.id] = {ready:false, number:0,};
        rooms[roomName].playerReadyCount = 0; //Increases each time a player sends a startGame request
        rooms[roomName].maxCapacity = playerCap; //max amount of players that can be in that room
        rooms[roomName].capacity = 1; //the current amount of players in that room. 1 since the creator automatically joins the lobby
        rooms[roomName].capacityNeeded = playersNeeded; //The number of players needed to start the game
        rooms[roomName].allowJoining = true; //Lets players join the game if this is true
        rooms[roomName].host = socket.id; //The id of the host (thus this player)
        rooms[roomName].privateBlackList = []; //Stores ips of banned clients
        rooms[roomName].publicBlackList = []; //Stores userIds of banned clients
        rooms[roomName].publicIds = [clients[socket.id].publicId]; //List the public ids of the clients corresponding to their number
        rooms[roomName].game = {
            players:[],
        };
        rooms[roomName].gameState =  {
            players:[],      
        };

        //Send a messge to the client that they are now the host of the room
        io.to(socket.id).emit("hostInfo", {isHost:true,});

        //Sends some room info to the player that is joining (the creator that is)
        io.to(socket.id).emit("roomInfo", getRoomInfo(roomName));
        
    }else{
        return;
    }
}

function leaveRoom(socket, io){

    //Checks to see if the client is actually in a room
    if(typeof clients[socket.id].room === "undefined"){socket.emit("error", "Not in a room and so cannot leave"); return;}

    //If the room does not have a record of this client then return just in case
    if(typeof rooms[clients[socket.id].room].clients[socket.id] === "undefined"){socket.emit("error", "Not in a room and so cannot leave"); return;}

    let roomName = clients[socket.id].room;
    let room = rooms[clients[socket.id].room];
    let playerNum = room.clients[socket.id].number; //The player number of the client that is leaving
    let roomClients = Object.keys(room.clients);

    //Leaves the room
    socket.leave(roomName);

    //Decreases the room's capacity as a player is leaving
    room.capacity--;
    
    //Check if the room is empty and if so it will delete the room else it will just update roomInfo
    if(room.capacity <= 0){
        let l;
        let k;
        let roomKeys = Object.keys(room);

        delete rooms[clients[socket.id].room];
    }else{

        //Decreases the room's ready count as well if they ready-ed up
        if(room.clients[socket.id].ready){
            room.playerReadyCount--;
        }
        
        //Update the list of players in the room
        //Removes the player from the character list
        room.characterList.splice(playerNum, 1);

        //Check if the player is in the middle of a game
        if(!room.allowJoining){
            //Remove the player from the game list
            let player;
            for(x in room.game.players){
                player = room.game.players[x];
                if(player.id === socket.id){
                    room.game.players.splice(x, 1);
                    room.gameState.players.splice(x, 1);
                }
            }
        }

        //Assigns a new number to the clients 
        for(x in roomClients){
            if(room.clients[roomClients[x]].number > playerNum){room.clients[roomClients[x]].number--;}
        }

        //Checks to see who will become the new host and updates the stuff related to that
        let j;
        let clientIds = Object.keys(room.clients);
        let isHost = false;
        for(j = 0; j < clientIds.length; j++){
            //If that client is in the first slot then they must be the host
            if(room.clients[clientIds[j]].number === 0){
                isHost = true;
                room.host = clientIds[j]; 
            }else{isHost = false;}

            io.to(clientIds[j]).emit("hostInfo", {isHost:isHost,});
        }

        //Delete the info the room had about the player that is now leaving
        delete room.clients[socket.id];

        //Broadcasts the change to the whole room
        io.to(roomName).emit("roomInfo", getRoomInfo(roomName));         
    }

     //Removes the client from the room's data set This must be called last
     clientRooms[socket.id] = undefined; //Defaults to nothing
     clients[socket.id].room = undefined; //Shows that the client is not in a lobby anymore

    //Sends to all clients the updated list of lobbies
    //io.emit("lobbyTableUpdate", getLobbies() );

}

io.on('connection', (socket) => {
    socket.emit("hello", "hello world!"); //"hello" is the event name and "hello world" is the message or data sent for that event

    //socket id is assigned to each user as their username for now
    usernames[socket.id] = socket.id;
    //add the client to the client list
    clients[socket.id] = {};
    //Generate a random username for the client
    clients[socket.id].username = generateName();
    //Add the socket object of that client to the client object
    clients[socket.id].socket = socket;
    //Generate a public id for that client in hex
    clients[socket.id].publicId = crypto.randomBytes(7).toString('hex');

    //create a room for the player upon connection
    createRoom(socket, io);

    socket.on("startGame", (roomName)=>{

        try{
            //If the room is nonexistent then don't do anything
            if(typeof rooms[roomName] === "undefined" || typeof rooms[roomName].capacity === "undefined"){socket.emit("error", "Cannot start game. Room does not exist."); return;}

            //If the client is not a part of the room specified then just quit
            if(typeof rooms[roomName].clients[socket.id] === "undefined"){socket.emit("error", "Cannot leave room as client is not a part of that room"); return;}
        
        }
        catch(err){
            return;
        }

        //For readability
        let room = rooms[roomName];
        let clientNames = Object.keys(rooms[roomName].clients);

        //If the player has not ready-ed up yet and wants to then increase the playerReadyCount and send the message that this player has ready-ed up
        if(!room.clients[socket.id].ready){
            room.clients[socket.id].ready = true; 
            room.playerReadyCount++;
            //Broadcasts the change to the whole room 
            io.to(roomName).emit("roomInfo", getRoomInfo(roomName));         
        }

        //If there is enough players ready-ed up then just start the game :)
        if(room.playerReadyCount >= room.capacityNeeded){

            //Tells the players that the game is starting
            io.to(roomName).emit("gameStart");
            
            //Stops players from joining the room as a game is now in session
            room.allowJoining = false; 

            let gameState = room.gameState;
            let game = room.game;
            let playerNum;

            //The game Loop
            let i; let z;
            //The game loop
            
            //give random dice numbers to all players (dice is faced 1 - 6)
            for(i = 0; i < room.capacity; i++){
                let dices = [crypto.randomInt(1,7), crypto.randomInt(1,7), crypto.randomInt(1,7), crypto.randomInt(1,7), crypto.randomInt(1,7)]
                socket.emit("diceNums", dices );
            }

            //Pick the 0th player and set tell them its their turn
            
            //not needed rn
            game.sendLoop = setInterval(()=>{
                io.to(roomName).emit("gameState", 1);
            }, 15);

        }
            
    });

    socket.on("joinGame", (roomName, callback)=>{
        try{
            if(typeof roomName !== "string"){socket.emit("error", "The room name must be a string"); return;}
            if(roomName.length > 10){socket.emit("error", "Room does not exist");return;}

            //If the room is nonexistent then don't join and send error message
            if(typeof rooms[roomName] === "undefined" || typeof rooms[roomName].capacity === "undefined"){socket.emit("error", "Room does not exist");return;}

            //If the room is empty then don't join and send error message
            if(rooms[roomName].capacity <= 0){socket.emit("error", "Room does not exist"); return;}

            //If the room has you on the private blackList then don't join
            let v;
            for(v in rooms[roomName].privateBlackList){
                if(rooms[roomName].privateBlackList[v] === socket.handshake.address){
                    socket.emit("error", "Can not join as you are banned from joining this room"); return;
                }
            }

            //If room is full then don't join and send error message
            if(rooms[roomName].capacity >= rooms[roomName].maxCapacity){socket.emit("error", "Room is full"); return;}

            //If room is already in session then don't join and send error message
            if(!rooms[roomName].allowJoining){socket.emit("error", "The game has already started in that room"); return;}

        }
        catch(err){
            return;
        }

        clientRooms[socket.id] = roomName; //Records what room the player is in
        clients[socket.id].room = roomName; //Records what room the player is in

        //Sends the gameCode to the client and connects them to that room
        socket.emit("gameCode", roomName); //This might not be necessary
        socket.join(roomName);

        //For readability or something
        let room = rooms[roomName];

        //Increases the playerCount of the room by 1 and adds the client to the room object
        room.clients[socket.id] = {ready:false,};
        room.capacity++;
     
        //Uses the playerList array to figure out if this player will be player 0 or player 1, or player 2, etc.
        room.clients[socket.id].number = Object.keys(room.clients).length - 1;

        //Add the public id of this client to the list
        room.publicIds[room.clients[socket.id].number] = clients[socket.id].publicId; //List the public ids of the clients corresponding to their number
        
        //Sends some room info to the player that is joining
        socket.emit("roomInfo", getRoomInfo(roomName));     

        //Sends a message to the client that the request has been sucessful and that they are now in a room
        callback(true);

        //console.log(room);

    } );

    socket.on("leaveGame", () =>{
        leaveRoom(socket, io);
     } );

     socket.on("disconnect", ()=>{

        //Checks to see if the client is actually in a room
        if(typeof clients[socket.id].room !== "undefined"){
            //If client is in a room:
            leaveRoom(socket, io);
        }else{
            //If client is NOT in a room
        }

    });
    
});


//get server ready to serve files
server.listen(process.env.PORT || 3001, () => {});


