/**
 * @fileOverview This file contains the entry point for the Interstellar
 * Armada (working name) program.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/**********************************************************************
    Copyright 2014 Krisztián Nagy
    
    This file is part of Interstellar Armada.

    Interstellar Armada is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Interstellar Armada is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

/**
 * Holds the Game object that contains the global properties of the game. This
 * should be the only global variable in the application.
 * @type Game
 */
var game;

/**
 * Returns an array containing the name of all the JavaScript source files of
 * the game.
 * @returns {String[]}
 */
function getSourceFiles() {
    return [
        "matrices.js",
        "egom.js",
        "graphics.js",
        "physics.js",
        "logic.js",
        "control.js"
    ];
}

/** 
 * Function to load additional JavaScript code from a list of source files.
 * Loads the scripts in the specified order, then executes a callback function.
 * @param {String[]} urls The list of JavaScript sourse files to load
 * @param {function} callback The function to call after loading the scripts
 * @param {Boolean} bypassCaching If true, the script files will be forcefully
 * downloaded again, even if they are in the cache already.
 */
function loadScripts(urls,bypassCaching,callback) {
    // We add a new script tag inside the head of the document
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = (bypassCaching?
                    urls.shift()+"?123":
                    urls.shift());        

    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    if(urls.length>0) {
		script.onload = function() {loadScripts(urls,bypassCaching,callback);};
		script.onreadystatechange = function() {loadScripts(urls,bypassCaching,callback);};
	} else if (callback!==undefined) {
		script.onload = callback;
		script.onreadystatechange = callback;
	}

    // Fire the loading
    head.appendChild(script);
}

/**
 * Defines a Game object.
 * @class Holds the general properties of the game (the current context for the
 * different modules)
 * @returns {Game}
 */
function Game() {
    this._screens = new Object();
    this._currentScreen = null;
    this.graphicsContext = new GraphicsContext(new ResourceCenter(),null);
}

/**
 * Adds a new screen to the list that can be set as current later.
 * @param {GameScreen} screen The new game screen to be added.
 */
Game.prototype.addScreen = function(screen) {
    this._screens[screen.getName()]=screen;
};

/**
 * Returns the game screen with the specified name that the game has.
 * @param {String} screenName
 * @returns {GameScreen}
 */
Game.prototype.getScreen = function(screenName) {
    return this._screens[screenName];
};

/**
 * Sets the current game screen to the one with the specified name (from the
 * list of available screens), including refreshing the HTML body.
 * @param {String} screenName
 */
Game.prototype.setCurrentScreen = function(screenName) {
    var screen = this.getScreen(screenName);
    screen.buildPage();
    this._currentScreen = screen;
};

/**
 * Gets the object corresponding to the currently set game screen.
 * @returns {GameScreen}
 */
Game.prototype.getCurrentScreen = function() {
    return this._currentScreen;
};

/**
 * Defines a GameScreen object.
 * @class Holds the logical model of a screen of the game. The different
 * screens should be defined as descendants of this class.
 * @param {String} name The name by which this screen can be identified.
 * @param {String} source The name of the HTML file where the structure of this
 * screen is defined.
 * @returns {GameScreen}
 */
function GameScreen(name,source) {
    // general properties
    this._name=name;
    this._source=source;
    this._model=null;
    
    // default components
    this._status=null;
    
    // function to execute when the model is loaded
    this._onModelLoad = function() {};
    
    // send an asynchronous request to grab the HTML file containing the DOM of
    // this screen
    if(this._source!==undefined) {
        var request = new XMLHttpRequest();
        request.open('GET', location.pathname+this._source+"?123", true);
        var self = this;
        request.onreadystatechange = function() {
                self._model = document.implementation.createHTMLDocument(self._name);
                self._model.documentElement.innerHTML = this.responseText;
                self._onModelLoad();
            };
        request.send(null);
    }
}

/**
 * Getter for the _name property.
 * @returns {String}
 */
GameScreen.prototype.getName = function() {
    return this._name;
};

/**
 * Replaces the current HTML page's body with the sctructure of the screen.
 */
GameScreen.prototype.buildPage = function() {
    var self = this;
    var buildPageFunction = function() {
        document.body=self._model.body.cloneNode(true);
        self._initializeComponents();
    };
    // if we have built up the model of the screen already, then load it
    if(this._model!==null) {
        buildPageFunction();
    // if not yet, set the callback function which fires when the model is 
    // loaded
    } else {
        this._onModelLoad = buildPageFunction;
    }
};

/**
 * Setting the properties that will be used to easier access DOM elements later.
 * In descendants, this method should be overwritten, adding the additional
 * components of the screen after calling this parent method.
 */
GameScreen.prototype._initializeComponents = function() {
    this._status = document.getElementById("status");
};

/**
 * Provides visual information to the user about the current status of the game.
 * @param {String} newStatus The new status to display.
 */
GameScreen.prototype.updateStatus = function(newStatus) {
    if (this._status!==null) {
        this._status.innerHTML=newStatus;
    } else {
        alert(newStatus);
    }
};

/** 
 * Downloads the newest version of all source files from the server and sets up
 * the global Game object. (to be called when index.html is loaded)
 */
function initialize() {
    loadScripts(getSourceFiles(),true,function(){ 
        game = new Game(); 
        game.addScreen(new GameScreen("mainMenu","index.html"));
        game.addScreen(new GameScreen("battle","battle.html"));
        game.addScreen(new GameScreen("database","database.html"));
        game.addScreen(new GameScreen("help","help.html"));
    });
}

/**
 * Goes to the battle screen, loads the needed resources and starts the
 * simulation and rendering loops.
 */
function initializeBattle() {
    game.setCurrentScreen("battle");
    loadBattleResources();
}

/**
 * Goes to the database screen, loads the needed resources and starts the
 * simulation and rendering loops. (not implemented yet)
 */
function initializeDatabase() {
    game.setCurrentScreen("database");
    loadDatabaseResources();
}

/**
 * Goes to the help screen.
 */
function initializeHelp() {
    game.setCurrentScreen("help");
}

var prevDate,curDate;
var mainScene;

var battleSimulationLoop;
var battleRenderLoop;

/**
 * Updates all needed variables when the screen is resized (camera perspective
 * matrices as well!)
 */
function resizeCanvas() {
   // only change the size of the canvas if the size it's being displayed
   // has changed.
   var canvas = document.getElementById("canvas");
   var width = canvas.clientWidth;
   var height = canvas.clientHeight;
   if (canvas.width !== width ||
       canvas.height !== height) {
     // Change the size of the canvas to match the size it's being displayed
     canvas.width = width;
     canvas.height = height;
   }
   if (mainScene!==undefined) {
       mainScene.resizeViewport(width,height);
   } 
}

/**
 * Main function loading the external resources required by the program. Builds
 * the test scene populated with random ships and fighters controlled by AI.
 * */
function loadBattleResources() {
	document.getElementById("output").style.display="none";
        document.getElementById("ui").style.display="none";
        
        var canvas = document.getElementById("canvas");
	var progress = document.getElementById("progress");
        
        var controlContext = new KeyboardControlContext();
	
	document.onkeydown = controlContext.handleKeyDown;
        document.onkeyup = controlContext.handleKeyUp;
        
        controlContext.addKeyCommand(new controlContext.KeyCommand("fire",              "space",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("changeFlightMode",  "o",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("forward",           "w",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("reverse",           "s",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("resetSpeed",        "backspace",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("yawLeft",           "left",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("yawRight",          "right",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("pitchDown",         "up",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("pitchUp",           "down",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("rollRight",         "page down",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("rollLeft",          "page up",false,false,false));
        
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraTurnLeft",    "left",false,true,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraTurnRight",   "right",false,true,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraTurnUp",      "up",false,true,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraTurnDown",    "down",false,true,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraMoveLeft",    "left",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraMoveRight",   "right",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraMoveUp",      "page up",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraMoveDown",    "page down",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraMoveForward", "up",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraMoveBackward","down",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraDecreaseFOV", "z",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("cameraIncreaseFOV", "u",false,false,false));
        
        controlContext.addKeyCommand(new controlContext.KeyCommand("pause",                 "p",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("changeView",            "v",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("followNext",            "c",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("followPrevious",        "x",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("setManualControl",      "m",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("setAIControl",          "n",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("stopAIShips",           "0",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("toggleLightRotation",   "l",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("toggleHitboxVisibility","h",false,false,false));
        controlContext.addKeyCommand(new controlContext.KeyCommand("quit",                  "escape",false,false,false));

        // test variable: number of random goals the AI controllers get at start
        var num_test_goals=10;
        // test variable: number of random fighters generated
        var num_test_fighters=40;
        // test variable: number of random ships generated
        var num_test_ships=15;
        // test variable: indicating the range within the random positions of fighters
        // and ships and the destinations of their goals are generated
        var mapSize=3000;

	var resourceCenter = game.graphicsContext.resourceCenter;
        resourceCenter.scenes= new Array();
	  
        resizeCanvas(); 
        // based on screen (canvas) size, set a maximum enabled LOD, so that
        // higher LOD models won't even get loaded during level initialization
        //(sparing memory, download time and performance)
        var maxLOD;
        if(canvas.width>=800) {
            maxLOD=4;
        } else if (canvas.width>=500) {
            maxLOD=3;
        } else if (canvas.width>=120) {
            maxLOD=2;
        } else {
            maxLOD=1;
        }
	mainScene = new Scene(0,0,canvas.width,canvas.height,true,[true,true,true,true],[0,0,0,1],true,new LODContext(maxLOD,[0,30,60,250,400]));
	//var pipScene = new Scene(canvas.width*2/3,canvas.height/4,canvas.width/3,canvas.height/2,false,[true,true,true,true],[0,0.5,0,0.5],true);
	
        // setting uniform valuables that are universal to all scene graph 
        // objects, so any shader used in the scene will be able to get their
        // values
	mainScene.uniformValueFunctions['u_lightDir'] = function() { return [-Math.cos(game.graphicsContext.lightAngle),0.0,Math.sin(game.graphicsContext.lightAngle)]; };
	mainScene.uniformValueFunctions['u_cameraMatrix'] = function() { return mul(mainScene.activeCamera.positionMatrix,mainScene.activeCamera.orientationMatrix); };
	mainScene.uniformValueFunctions['u_projMatrix'] = function() { return mainScene.activeCamera.perspectiveMatrix; };
	mainScene.uniformValueFunctions['u_eyePos'] = function() 
		{
			var eyePos = [
				-mainScene.activeCamera.positionMatrix[12],
				-mainScene.activeCamera.positionMatrix[13],
				-mainScene.activeCamera.positionMatrix[14]
				];
			return [eyePos[0],eyePos[1],eyePos[2]]; 
		};
	
	resourceCenter.scenes.push(mainScene);
	//resourceCenter.scenes.push(pipScene);
        //pipScene.objects.push(new VisualObject(fregattModel,metalTexture,greenShader,0.0045,translationMatrix(0.0,0.0,-2.0),true));
	
	var test_level = new Level(resourceCenter,mainScene,controlContext);
	
        // this loads the level and all needed other resources (models, shaders)
        // from the XML files
	test_level.loadFromFile("level.xml");
	
	progress.value=50;
	game.getCurrentScreen().updateStatus("loading additional configuration...");
	
        // we turn the cruizer around so it looks nicer at start :)
	test_level.spacecrafts[test_level.spacecrafts.length-1].physicalModel.orientationMatrix=
		mul(
			rotationMatrix4([0,1,0],3.1415/4),
			rotationMatrix4([0,0,1],3.1415/2)
			);
                
        var graphicsContext = new GraphicsContext(resourceCenter,mainScene);
        var logicContext = new LogicContext(test_level);
	
        // adding random fighters to the scene to test performance
	for(var i=0;i<num_test_fighters;i++) {
		test_level.spacecrafts.push(
			new Spacecraft(
				graphicsContext,
				logicContext,
                                controlContext,
				test_level.getSpacecraftClass("falcon"),
				test_level.getPlayer("human"),
				translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2),
				"ai"
				)
			);
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("plasma"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("plasma"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addPropulsion(resourceCenter,test_level.getPropulsionClass("fighter"));
	}
	
        // adding random ships to the scene to test performance
	for(var i=0;i<num_test_ships;i++) {
		test_level.spacecrafts.push(
			new Spacecraft(
				graphicsContext,
				logicContext,
                                controlContext,
				test_level.getSpacecraftClass("taurus"),
				test_level.getPlayer("human"),
				translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2),
				"ai"
				)
			);
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("cannon"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("cannon"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addPropulsion(resourceCenter,test_level.getPropulsionClass("frigate"));
	}
        
        // adding a sphere model for testing the shading
        /*var sphereModel = new EgomModel();
        // 100x downsized earth
        sphereModel.addSphere(0,0,0,63710,64,[1.0,1.0,1.0,1.0],0,20,[[0,0],[0,1.0],[1.0,1.0]],false);
        sphereModel.filename="sphere";
        sphereModel.size=127420;
        mainScene.objects.push(new Mesh([new ModelWithLOD(resourceCenter.addModel(sphereModel,"sphere"),0)],resourceCenter.getShader("simple"),resourceCenter.getTexture("textures/earthmap1k.jpg"),translationMatrix(0,0,-73710),identityMatrix4(),identityMatrix4(),false));
        mainScene.objects[mainScene.objects.length-1].orientationMatrix=
                //mul(
                //    rotationMatrix4([1,0,0],3.1415/4),
                    rotationMatrix4([1,0,0],-3.1415*0.75);
                //);*/
	
        /*var sphereModel = new EgomModel();
        sphereModel.addSphere(0,0,0,5,64,[1.0,1.0,1.0,1.0],0,20,[[0,0],[0,1.0],[1.0,1.0]],false);
        sphereModel.filename="sphere";
        sphereModel.size=10;
        // adding random goals to the AI for testing
	for(var i=0;i<test_level.spacecrafts.length;i++) {
		for(var j=0;j<num_test_goals;j++) {
                        var goalPosition = translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2);
			test_level.spacecrafts[i].controller.goals.push(new Goal(goalPosition));
                        if (i===0) {
                            mainScene.objects.push(new Mesh([new ModelWithLOD(resourceCenter.addModel(sphereModel,"sphere"),0)],resourceCenter.getShader("simple"),resourceCenter.getTexture("textures/earthmap1k.jpg"),goalPosition,identityMatrix4(),identityMatrix4(),false));
                        }
		}
	}*/
	/*
        // setting up the position and direction of the main camera
	mainScene.activeCamera.positionMatrix=translationMatrix(0,10,-10);
	mainScene.activeCamera.orientationMatrix=rotationMatrix4([1,0,0],3.1415/4);
        */
	
	var freq = 60;
	
	progress.value=75;
	
	resourceCenter.init(canvas,freq);
        
        var globalCommands=initGlobalCommands(graphicsContext,logicContext,controlContext);

	prevDate = new Date();

	battleSimulationLoop = setInterval(function()
		{
			curDate=new Date();
			test_level.tick(curDate-prevDate);
                        prevDate=curDate;
			control(mainScene,test_level,globalCommands);
			game.graphicsContext.lightAngle+=game.graphicsContext.lightIsTurning?0.07:0.0;
		},1000/freq);
}

function loadDatabaseResources() {
    
}