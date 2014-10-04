/**
 * @fileOverview This is the main source file of Interstellar Armada. It has
 * to be referenced by index.html. It defines the folders where the resource
 * files can be found, loads all the other sources and initializes the game
 * by creating the global {@link game} object.<br/>
 * This is the only file that should contain global variables and functions.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1-dev
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

// This function initializes the game by downloading all needed source files
// and setting up the game functions. The only function called directly from
// javascript source - all others are inside classes, are general utility
// functions or assignments of prototypes and constructors for inheritance.
initialize();

/* The names of source files and folders are defined in global functions, as
 * - game should be the only global variable
 * - they don't belong to the game object (the game object is initialized after
 * all source files are loaded)
 * - they might contain calculations/functions later, which is more appropriate
 * to put inside a function then a global variable definition
 * - the declarations are moved above all definitions, and this way the 
 * operations to get the names happen when the function is called, not when the
 * definition is executed (as is the case with variables)
 */

/**
 * Returns an array containing the name of all the JavaScript source files of
 * the game.
 * @returns {String[]}
 */
function getSourceFiles() {
    return [
        "matrices.js",
        "gl.js",
        "egom.js",
        "graphics.js",
        "scene.js",
        "resource.js",
        "components.js",
        "screens.js",
        "physics.js",
        "classes.js",
        "logic.js",
        "control.js",
        "game.js"
    ];
}

/**
 * All the JavaScript (.js) source files (returned by getSourceFiles()) have to 
 * be placed in this folder.
 * @returns {String}
 */
function getJavaScriptFolder() {
    return "js/";
}

/**
 * All the components' (ScreenComponent class) HTML source files have to be 
 * placed in this folder.
 * @returns {String}
 */
function getComponentFolder() {
    return "components/";
}

/**
 * All the 3D model files (.egm) have to be placed in this folder.
 * @returns {String}
 */
function getModelFolder() {
    return "models/";
}

/**
 * All the GLSL shader source files (.vert, .frag) have to be placed in this 
 * folder.
 * @returns {String}
 */
function getShaderFolder() {
    return "shaders/";
}

/**
 * All the texture files have to be placed in this folder.
 * @returns {String}
 */
function getTextureFolder() {
    return "textures/";
}

/**
 * Folder to place the XML files to (settings, descriptions of in-game classes,
 * levels, etc)
 * @returns {String}
 */
function getXMLFolder() {
    return "xml/";
}

/** 
 * Function to load additional JavaScript code from a list of source files.
 * Loads the scripts in the specified order, then executes a callback function.
 * @param {String} folder The folder where the scripts reside
 * @param {String[]} filenames The list of JavaScript sourse files to load
 * @param {Function} callback The function to call after loading the scripts
 * @param {Boolean} bypassCaching If true, the script files will be forcefully
 * downloaded again, even if they are in the cache already.
 */
function loadScripts(folder, filenames, bypassCaching, callback) {
    // NOTE: recursive function - if the arguments are changed, change the calls
    // as well
    // We add a new script tag inside the head of the document
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = folder + (bypassCaching ?
            filenames.shift() + "?123" :
            filenames.shift());

    var loadNextScriptFunction = function () {
        loadScripts(folder, filenames, bypassCaching, callback);
    };
    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    if (filenames.length > 0) {
        script.addEventListener("load",loadNextScriptFunction);
        script.addEventListener("readystatechange",loadNextScriptFunction);
    } else if (callback !== undefined) {
        script.addEventListener("load",callback);
        script.addEventListener("readystatechange",callback);
    }

    // Fire the loading
    document.head.appendChild(script);
}

/** 
 * Downloads the newest version of all source files from the server and after 
 * that sets up the global Game object.
 */
function initialize() {
    loadScripts(getJavaScriptFolder(),getSourceFiles(),true,function(){ 
        game = new Game(); 
        game.addScreen(new MenuScreen("mainMenu","index.html",
            [
                {
                    caption: "Play the game", 
                    action: function() {game.setCurrentScreen("battle"); loadBattleResources();} 
                },
                {
                    caption: "Database", 
                    action: function(){ game.setCurrentScreen("database"); } 
                },
                {
                    caption: "Keyboard controls", 
                    action: function(){ game.setCurrentScreen("help"); } 
                },
                {
                    caption: "About", 
                    action: function(){ game.setCurrentScreen("about"); } 
                }
            ],"menuContainer"));
        game.addScreen(new BattleScreen("battle","battle.html"));
        game.addScreen(new GameScreenWithCanvases("database","database.html"));
        game.addScreen(new HelpScreen("help","help.html"));
        game.addScreen(new GameScreen("about","about.html"));
        game.addScreen(new MenuScreen("ingameMenu","ingamemenu.html",
            [
                {
                    caption: "Resume game",
                    action: function () { 
                        game.closeSuperimposedScreen();
                        game.controlContext.activate();
                    }
                },
                {
                    caption: "Controls",
                    action: function () { game.setCurrentScreen("help",true,[64,64,64],0.5); }
                },
                {
                    caption: "Quit to main menu",
                    action: function () { 
                        clearInterval(battleSimulationLoop);
                        game.setCurrentScreen("mainMenu"); 
                    }
                }
            ],"menuContainer"));
        game.setCurrentScreen("mainMenu");
    });
}

function loadTestConfiguration(test_level,testShips,mapSize) {
    for(var shipClass in testShips) {
        for (var i = 0; i < testShips[shipClass]; i++) {
            test_level.spacecrafts.push(
                new Spacecraft(
                    game.graphicsContext,
                    game.logicContext,
                    game.controlContext,
                    game.logicContext.getSpacecraftClass(shipClass),
                    test_level.getPlayer("human"),
                    translationMatrix(Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2),
                    identityMatrix4(),
                    "ai",
                    "default"
                )
            );
        }
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
    // test variable: number of random goals the AI controllers get at start
    var num_test_goals=10;
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
}

/**
 * Old function under refactoring, its content will go under several methods of
 * different classes.
 */
function loadBattleResources() {
    game.getCurrentScreen().hideStats();
    game.getCurrentScreen().hideUI();
    game.getCurrentScreen().getInfoBox().hide();
	
    game.controlContext.activate();
	  
    game.getCurrentScreen().resizeCanvases(); 
          
    var canvas = game.getCurrentScreen().getCanvas();
    var mainScene = new Scene(0,0,canvas.width,canvas.height,true,[true,true,true,true],[0,0,0,1],true,game.graphicsContext.getLODContext());
    
    game.getCurrentScreen().addScene(mainScene);
    
    game.graphicsContext.scene = mainScene;
        
    var test_level = new Level();
    game.logicContext.level = test_level;
	    
    test_level.onLoad = function () {
        game.getCurrentScreen().updateStatus("loading additional configuration...", 50);
        loadTestConfiguration(test_level, {falcon: 30, viper: 10, aries: 5, taurus: 10}, 3000);
        game.getCurrentScreen().updateStatus("", 75);

        var freq = 60;
        game.graphicsContext.resourceCenter.init(canvas, game.graphicsContext.getAntialiasing(), freq);

        var globalCommands = initGlobalCommands(game.graphicsContext, game.logicContext, game.controlContext);

        prevDate = new Date();

        battleSimulationLoop = setInterval(function ()
        {
            var i;
            curDate = new Date();
            test_level.tick(curDate - prevDate);
            prevDate = curDate;
            control(game.graphicsContext.scene, test_level, globalCommands);
            if (game.graphicsContext.lightIsTurning) {
                var rotMatrix = rotationMatrix4([0.0,1.0,0.0],0.07);
                for(i=0;i<test_level.backgroundObjects.length;i++) {
                    test_level.backgroundObjects[i].position = vector3Matrix4Product(test_level.backgroundObjects[i].position,rotMatrix);
                }                
            }
        }, 1000 / freq);
    };
    
    test_level.requestLoadFromFile("level.xml");
}