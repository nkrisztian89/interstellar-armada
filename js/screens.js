/**
 * @fileOverview This file defines the GameScreen class and its descendant
 * classes, which load and manipulate the DOM of the HTML pages and control
 * the rendering of scenes to the canvas elements.
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
    this._status = null;
    this._background = null;
    this._registeredComponents = new Array();
    
    // function to execute when the model is loaded
    this._onModelLoad = function() {};
        
    // source will be undefined when setting the prototypes for inheritance
    if(source!==undefined) {
        this.requestModelLoad();
    }
}

/**
 * Initiates the asynchronous loading of the screen's structure from the
 * external HTML file.
 */
GameScreen.prototype.requestModelLoad = function() {
    // send an asynchronous request to grab the HTML file containing the DOM of
    // this screen
    var request = new XMLHttpRequest();
    request.open('GET', location.pathname+this._source+"?123", true);
    var self = this;
    request.onreadystatechange = function() {
            self._model = document.implementation.createHTMLDocument(self._name);
            self._model.documentElement.innerHTML = this.responseText;
            self._onModelLoad();
        };
    request.send(null);
};

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
 * Superimposes the screen on the current page, by appending a full screen
 * container and the screen structure as its child inside it.
 * @param {Number[3]} color The color of the full screen background. ([r,g,b],
 * where all color components should be 0-255)
 * @param {Number} opacity The opacity of the background (0.0-1.0)
 */
GameScreen.prototype.superimposeOnPage = function(color,opacity) {
    var self = this;
    var superimposeOnPageFunction = function() {
        self._background = document.createElement("div");
        self._background.className = "fullScreenFix";
        self._background.style.backgroundColor = "rgba("+color[0]+","+color[1]+","+color[2]+","+opacity+")";
        var container = document.createElement("div");
        container.className = "fullScreenContainer";
        container.innerHTML = self._model.body.innerHTML;
        document.body.appendChild(self._background);
        document.body.appendChild(container);
        self._initializeComponents();
    };
    // if we have built up the model of the screen already, then load it
    if(this._model!==null) {
        superimposeOnPageFunction();
    // if not yet, set the callback function which fires when the model is 
    // loaded
    } else {
        this._onModelLoad = superimposeOnPageFunction;
    }
};

/**
 * Tells whether the screen is superimposed on top of another one.
 * @returns {Boolean}
 */
GameScreen.prototype.isSuperimposed = function() {
    return this._background!==null;
};

/**
 * Executes the necessary actions required when closing the page. This method
 * only nulls out the default components, additional functions need to be added
 * in the descendant classes.
 */
GameScreen.prototype.closePage = function() {
    this._status = null;
    
    for(var i=0;i<this._registeredComponents.length;i++) {
        this._registeredComponents[i].component.resetComponent();
    }
};

/**
 * Closes the superimposed page by removing the background container next to
 * the regular page closing actions.
 */
GameScreen.prototype.closeSuperimposedPage = function() {
    if(!this.isSuperimposed()) {
        game.showError("Attempting to close a page ("+this._name+") as if it was superimposed, but in fact it is not.");
    } else {
        document.body.removeChild(this._background.nextSibling);
        document.body.removeChild(this._background);
        this._background = null;
        this.closePage();
    }
};

/**
 * Setting the properties that will be used to easier access DOM elements later.
 * In descendants, this method should be overwritten, adding the additional
 * components of the screen after calling this parent method.
 */
GameScreen.prototype._initializeComponents = function() {
    this._status = document.getElementById("status");
    
    for(var i=0;i<this._registeredComponents.length;i++) {
        var parentNode;
        if(this._registeredComponents[i].parentNodeID!==undefined) {
            parentNode = document.getElementById(this._registeredComponents[i].parentNodeID);
        }
        // otherwise just leave it undefined, nothing to pass to the method below
        this.addExternalComponent(this._registeredComponents[i].component,parentNode);
    }
};

GameScreen.prototype.registerComponent = function(screenComponent,parentNodeID) {
    this._registeredComponents.push({
        component: screenComponent,
        parentNodeID: parentNodeID
    });
    return screenComponent;
};

/**
 * Appends the elements of an external component (a HTML document fragment
 * defined in an external xml file) to the DOM tree and returns the same 
 * component.
 * @param {ScreenComponent} screenComponent
 * @param {Node} [parentNode] The node in the document to which to append the
 * component (if omitted, it will be appended to the body)
 * @returns {ScreenComponent}
 */
GameScreen.prototype.addExternalComponent = function(screenComponent,parentNode) {
    screenComponent.appendToPage(parentNode);
    return screenComponent;
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
 * An enhanced canvas element (a wrapper around a regular HTML canvas), that
 * can create and hold a reference to a managed WebGL context for the canvas.
 * @param {HTMLCanvasElement} canvas The canvas around which this object should
 * be created.
 * @returns {ScreenCanvas}
 */
function ScreenCanvas(canvas) {
    this._canvas = canvas;
    this._name = canvas.getAttribute("id");
    this._resizeable = canvas.classList.contains("resizeable");
    this._context = null;
}

/**
 * Returns the stored HTML canvas element.
 * @returns {HTMLCanvasElement}
 */
ScreenCanvas.prototype.getCanvasElement = function() {
    return this._canvas;
};

/**
 * Tells if the canvas is resizeable = if it has a dynamic size that changes
 * when the window is resized.
 * @returns {Boolean}
 */
ScreenCanvas.prototype.isResizeable = function() {
    return this._resizeable;
};

/**
 * Returns a managed WebGL context created for the canvas. It creates the 
 * context if it does not exist yet.
 * @returns {ManagedGLContext}
 */
ScreenCanvas.prototype.getManagedContext = function() {
    if(this._context === null) {
        this._context = new ManagedGLContext(this._canvas,game.graphicsContext.getAntialiasing(),game.graphicsContext.getFiltering());
    }
    return this._context;
};

/**
 * Defines a game screen with canvases object.
 * @class Represents a game screen that has one or more canvases where WebGL
 * scenes can be rendered.
 * @extends GameScreen
 * @param {String} name The name by which this screen can be identified.
 * @param {String} source The name of the HTML file where the structure of this
 * screen is defined.
 * @returns {GameScreenWithCanvases}
 */
function GameScreenWithCanvases(name,source) {
    GameScreen.call(this,name,source);
    
    this._canvases = new Object();
        
    this._sceneCanvasBindings = new Array();
    
    this._renderLoop = null;
    
    this._renderTimes = null;
    
    this._resizeEventListener = null;
};

GameScreenWithCanvases.prototype=new GameScreen();
GameScreenWithCanvases.prototype.constructor=GameScreenWithCanvases;

/**
 * Stops the render loop and nulls out the components.
 */
GameScreenWithCanvases.prototype.closePage = function() {
    GameScreen.prototype.closePage.call(this);
    
    this.stopRenderLoop();
    
    window.removeEventListener("resize",this._resizeEventListener);
    this._resizeEventListener = null;
    
    this._canvases = new Object();
        
    this._sceneCanvasBindings = new Array();
    
    game.graphicsContext.resourceManager.clearResourceContextBindings();
};

/**
 * Initializes the components of the parent class, then the additional ones for
 * this class (the canvases).
 */
GameScreenWithCanvases.prototype._initializeComponents = function() {
    GameScreen.prototype._initializeComponents.call(this);
    
    var canvasElements = document.getElementsByTagName("canvas");
    for(var i=0;i<canvasElements.length;i++) {
        this._canvases[canvasElements[i].getAttribute("id")] = new ScreenCanvas(canvasElements[i]);
    }
    
    var self = this;
    this._resizeEventListener = function() { self.resizeCanvases.call(self); };
    window.addEventListener("resize",this._resizeEventListener);
};

/**
 * Returns the stored canvas component that has the passed name.
 * @param {String} name
 * @returns {ScreenCanvas}
 */
GameScreenWithCanvases.prototype.getScreenCanvas = function(name) {
    return this._canvases[name];
}; 

/**
 * Creates a binding between the passed scene and canvas, causing the scene to
 * be rendered on the canvas automatically in the render loop of this screen.
 * @param {Scene} scene
 * @param {ScreenCanvas} canvas
 */
GameScreenWithCanvases.prototype.bindSceneToCanvas = function(scene,canvas) {
    var alreadyBound = false;
    for(var i=0;i<this._sceneCanvasBindings.length;i++) {
        if(
            (this._sceneCanvasBindings[i].scene===scene)&&
            (this._sceneCanvasBindings[i].canvas===canvas)
        ) {
            alreadyBound = true;
        }
    }
    if (alreadyBound === false) {
        this._sceneCanvasBindings.push({
            scene: scene,
            canvas: canvas
        });
    }
    scene.addToContext(canvas.getManagedContext());
    if(this._renderLoop !== null) {
        canvas.getManagedContext().setupVertexBuffers(true);
    }
};

/**
 * Renders the scenes displayed on this screen.
 */
GameScreenWithCanvases.prototype.render = function() {
    var i;
    for(i=0;i<this._sceneCanvasBindings.length;i++) {
        this._sceneCanvasBindings[i].scene.cleanUp();
        this._sceneCanvasBindings[i].scene.render(this._sceneCanvasBindings[i].canvas.getManagedContext());
    }
    var d = new Date();
    this._renderTimes.push(d);
    while((this._renderTimes.length>1)&&((d-this._renderTimes[0])>1000)) {
        this._renderTimes.shift();
    }
};

/**
 * Starts the render loop, by beginning to execute the render function every
 * interval milliseconds.
 * @param {Number} interval
 */
GameScreenWithCanvases.prototype.startRenderLoop = function(interval) {
    var i;
    for(i=0;i<this._sceneCanvasBindings.length;i++) {
        this._sceneCanvasBindings[i].canvas.getManagedContext().setupVertexBuffers(true);
    }
    var self = this;
    this._renderTimes = [new Date()];
    this._renderLoop = setInterval(function() { self.render(); },interval);
};

/**
 * Stops the render loop.
 */
GameScreenWithCanvases.prototype.stopRenderLoop = function() {
    clearInterval(this._renderLoop);
    this._renderLoop = null;
};

/**
 * Returns the Frames Per Second count for this screen's render loop.
 * @returns {Number}
 */
GameScreenWithCanvases.prototype.getFPS = function() {
    return this._renderTimes.length;
};

GameScreenWithCanvases.prototype.resizeCanvas = function(name) {
    var i;
    var canvasElement = this._canvases[name].getCanvasElement();
    var width = canvasElement.clientWidth;
    var height = canvasElement.clientHeight;
    if (canvasElement.width !== width ||
        canvasElement.height !== height) {
        // Change the size of the canvas to match the size it's being displayed
        canvasElement.width = width;
        canvasElement.height = height;
    }
    // updated the variables in the scenes
    for (i = 0; i < this._sceneCanvasBindings.length; i++) {
        if(this._sceneCanvasBindings[i].canvas===this._canvases[name]) {
            this._sceneCanvasBindings[i].scene.resizeViewport(
                canvasElement.width,
                canvasElement.height
            );
        }
    }
};

/**
 * Updates all needed variables when the screen is resized (camera perspective
 * matrices as well!)
 */
GameScreenWithCanvases.prototype.resizeCanvases = function() {
    // first, update the canvas width and height properties if the client width/
    // height has changed
    for (var canvasName in this._canvases) {
        if(this._canvases[canvasName].isResizeable()===true) {
            this.resizeCanvas(canvasName);
        }
    }
};

/**
 * Defines a battle screen object.
 * @class Represents the battle screen.
 * @extends GameScreenWithCanvases
 * @param {String} name The name by which this screen can be identified.
 * @param {String} source The name of the HTML file where the structure of this
 * screen is defined.
 * @returns {BattleScreen}
 */
function BattleScreen(name,source) {
    GameScreenWithCanvases.call(this,name,source);
        
    this._stats=null;
    this._ui=null;
    
    this._loadingBox = this.registerComponent(new LoadingBox("loadingBox","loadingbox.html"));
    this._infoBox = this.registerComponent(new InfoBox("infoBox","infobox.html"));
};

BattleScreen.prototype=new GameScreenWithCanvases();
BattleScreen.prototype.constructor=BattleScreen;

/**
 * Nulls out the components.
 */
BattleScreen.prototype.closePage = function() {
    GameScreenWithCanvases.prototype.closePage.call(this);
    
    this._stats = null;
    this._ui = null;
};

/**
 * Initializes the components of the parent class, then the additional ones for
 * this class.
 */
BattleScreen.prototype._initializeComponents = function() {
    GameScreenWithCanvases.prototype._initializeComponents.call(this);
    
    this._stats = document.getElementById("stats");
    this._ui= document.getElementById("ui");
};

/**
 * Getter for the _loadingBox property.
 * @returns {LoadingBox}
 */
BattleScreen.prototype.getLoadingBox = function() {
    return this._loadingBox;
};

/**
 * Getter for the _infoBox property.
 * @returns {InfoBox}
 */
BattleScreen.prototype.getInfoBox = function() {
    return this._infoBox;
};

/**
 * Uses the loading box to show the status to the user.
 * @param {String} newStatus The status to show on the loading box. If
 * undefined, the status won't be updated.
 * @param {Number} newProgress The new value of the progress bar on the loading
 * box. If undefined, the value won't be updated.
 */
BattleScreen.prototype.updateStatus = function(newStatus,newProgress) {
    if(newStatus!==undefined) {
        this._loadingBox.updateStatus(newStatus);
    }
    if(newProgress!==undefined) {
        this._loadingBox.updateProgress(newProgress);
    }
};

/**
 * Hides the stats (FPS, draw stats) component.
 */
BattleScreen.prototype.hideStats = function() {
    this._stats.style.display="none";
};

/**
 * Hides the UI (information about controlled spacecraft) component.
 */
BattleScreen.prototype.hideUI = function() {
    this._ui.style.display="none";
};

/**
 * Shows the stats (FPS, draw stats) component.
 */
BattleScreen.prototype.showStats = function() {
    this._stats.style.display="block";
};

/**
 * Shows the UI (information about controlled spacecraft) component.
 */
BattleScreen.prototype.showUI = function() {
    this._ui.style.display="block";
};

/**
 * Shows the given message to the user in an information box.
 * @param {String} message
 */
BattleScreen.prototype.showMessage = function(message) {
    this._infoBox.updateMessage(message);
    this._infoBox.show();
};

BattleScreen.prototype.render = function() {
    GameScreenWithCanvases.prototype.render.call(this);
    this._stats.innerHTML = this.getFPS()+"<br/>"+this._sceneCanvasBindings[0].scene.getNumberOfDrawnTriangles();
};

BattleScreen.prototype.startNewBattle = function(levelSourceFilename) {
    this.hideStats();
    this.hideUI();
    this._loadingBox.show();
    this._infoBox.hide();
    this.resizeCanvases(); 
    
    var test_level = new Level();
    game.logicContext.level = test_level;
    
    var self = this;
    
    test_level.onLoad = function () {
        self.updateStatus("loading additional configuration...", 5);
        test_level.addRandomShips("human",{falcon: 30, viper: 10, aries: 5, taurus: 10}, 3000);
        
        self.updateStatus("building scene...",10);
        var canvas = self.getScreenCanvas("battleCanvas").getCanvasElement();
        game.graphicsContext.scene = new Scene(0,0,canvas.width,canvas.height,true,[true,true,true,true],[0,0,0,1],true,game.graphicsContext.getLODContext());
        test_level.buildScene(game.graphicsContext.scene);

        self.updateStatus("loading graphical resources...",15);
        game.graphicsContext.resourceManager.onResourceLoad = function(resourceName,totalResources,loadedResources) {
            self.updateStatus("loaded "+resourceName+", total progress: "+loadedResources+"/"+totalResources,20+(loadedResources/totalResources)*60);
        };
        var freq = 60;
        game.graphicsContext.resourceManager.executeWhenReady(function() { 
            self.updateStatus("initializing WebGL...",75);
            self.bindSceneToCanvas(game.graphicsContext.scene,self.getScreenCanvas("battleCanvas"));
            test_level.addProjectileResourcesToContext(self.getScreenCanvas("battleCanvas").getManagedContext());
            self.updateStatus("",100);
            self.showMessage("Ready!");
            self.getLoadingBox().hide();
            self.showStats();
            self.startRenderLoop(1000/freq);
        });
        
        game.graphicsContext.resourceManager.requestResourceLoad();

        game.controlContext.activate();

        prevDate = new Date();
        
        battleSimulationLoop = setInterval(function ()
        {
            curDate = new Date();
            test_level.tick(curDate - prevDate);
            prevDate = curDate;
            control(game.graphicsContext.scene, test_level, game.controlContext.globalActions);
        }, 1000 / freq);
    };
    
    self.updateStatus("loading level information...",0);
    test_level.requestLoadFromFile(levelSourceFilename);
};

/**
 * Defines a database screen object.
 * @class Represents the database screen.
 * @extends GameScreenWithCanvases
 * @param {String} name The name by which this screen can be identified.
 * @param {String} source The name of the HTML file where the structure of this
 * screen is defined.
 * @returns {DatabaseScreen}
 */
function DatabaseScreen(name,source) {
    GameScreenWithCanvases.call(this,name,source);
    
    this._loadingBox = this.registerComponent(new LoadingBox("loadingBox","loadingbox.html"));
    
    this._itemName = null;
    this._itemType = null;
    this._itemDescription = null;
    
    this._scene = null;
    this._item = null;
    this._itemIndex = null;
    this._rotationLoop = null;
};

DatabaseScreen.prototype=new GameScreenWithCanvases();
DatabaseScreen.prototype.constructor=DatabaseScreen;

/**
 * Nulls out the components.
 */
DatabaseScreen.prototype.closePage = function() {
    GameScreenWithCanvases.prototype.closePage.call(this);
        
    this._itemName = null;
    this._itemType = null;
    this._itemDescription = null;
    
    clearInterval(this._rotationLoop);
    this._item = null;
    this._itemIndex = null;
    this._scene = null;
};

/**
 * Initializes the components of the parent class, then the additional ones for
 * this class.
 */
DatabaseScreen.prototype._initializeComponents = function() {
    GameScreenWithCanvases.prototype._initializeComponents.call(this);
    
    var prevButton = document.getElementById("prevButton");
    var self = this;
    prevButton.addEventListener("click",function(){
        self.selectPreviousShip();
    });
    var nextButton = document.getElementById("nextButton");
    var self = this;
    nextButton.addEventListener("click",function(){
        self.selectNextShip();
    });
    
    this._itemName = document.getElementById("itemName");
    this._itemType = document.getElementById("itemType");
    this._itemDescription = document.getElementById("itemDescription");
    
    this.initializeCanvas();
};

/**
 * Getter for the _loadingBox property.
 * @returns {LoadingBox}
 */
DatabaseScreen.prototype.getLoadingBox = function() {
    return this._loadingBox;
};

/**
 * Uses the loading box to show the status to the user.
 * @param {String} newStatus The status to show on the loading box. If
 * undefined, the status won't be updated.
 * @param {Number} newProgress The new value of the progress bar on the loading
 * box. If undefined, the value won't be updated.
 */
DatabaseScreen.prototype.updateStatus = function(newStatus,newProgress) {
    if(newStatus!==undefined) {
        this._loadingBox.updateStatus(newStatus);
    }
    if(newProgress!==undefined) {
        this._loadingBox.updateProgress(newProgress);
    }
};

DatabaseScreen.prototype.startRotationLoop = function() {
    var prevDate = new Date();
    var self = this;    
    this._rotationLoop = setInterval(function ()
    {
        var i;
        var curDate = new Date();
        self._item.visualModel.rotate(self._item.visualModel.getZDirectionVector(),0.001*(curDate-prevDate));
        prevDate = curDate;
    }, 1000 / 60);
};

DatabaseScreen.prototype.stopRotationLoop = function() {
    clearInterval(this._rotationLoop);
};

DatabaseScreen.prototype.initializeCanvas = function() {
    this._loadingBox.show();
    this.updateStatus("initializing database...", 0);
        
    this.resizeCanvas("databaseCanvas");
    var canvas = this.getScreenCanvas("databaseCanvas").getCanvasElement();
    this._scene = new Scene(0,0,canvas.clientWidth,canvas.clientHeight,false,[true,true,true,true],[0,0,0,1],true,game.graphicsContext.getLODContext());
    this._scene.addLightSource(new LightSource([1.0,1.0,1.0],[-1.0,0.0,1.0]));

    var self = this;
    game.graphicsContext.resourceManager.onResourceLoad = function(resourceName,totalResources,loadedResources) {
        self.updateStatus("loaded "+resourceName+", total progress: "+loadedResources+"/"+totalResources,20+(loadedResources/totalResources)*60);
    };
    game.graphicsContext.resourceManager.executeWhenReady(function() { 
        self.updateStatus("",100);
        self._loadingBox.hide();
    });
    
    this.updateStatus("loading graphical resources...",15);
    
    this._itemIndex = 0;
    this.loadShip();
};

DatabaseScreen.prototype.selectPreviousShip = function() {
    this._itemIndex -= 1;
    if(this._itemIndex===-1) {
        this._itemIndex = game.logicContext.getSpacecraftClasses().length-1;
    }
    this.loadShip();
};

DatabaseScreen.prototype.selectNextShip = function() {
    this._itemIndex = (this._itemIndex+1)%game.logicContext.getSpacecraftClasses().length;
    this.loadShip();
};

DatabaseScreen.prototype.loadShip = function() {
    var shipClass = game.logicContext.getSpacecraftClasses()[this._itemIndex];
    
    this.stopRotationLoop();
    this.stopRenderLoop();
    this._item = new Spacecraft(
        shipClass,
        "",
        identityMatrix4(),
        identityMatrix4(),
        "ai",
        "default"
        );
    this._scene.clearObjects();
    this._item.addToScene(this._scene,game.graphicsContext.getMaxLoadedLOD(),false,true,true);
    this._item.visualModel.rotate([1.0,0.0,0.0],60/180*Math.PI);
    
    var self = this;
    game.graphicsContext.resourceManager.executeWhenReady(function() { 
        self._itemName.innerHTML = shipClass.getFullName();
        self._itemType.innerHTML = shipClass.getSpacecraftType().getFullName();
        var length = self._item.visualModel.modelsWithLOD[0].model.dimensions[1]*0.2;
        self._itemDescription.innerHTML = 
            shipClass.getDescription()+"<br/>"+
            "<br/>"+
            "Length: "+((length<100)?length.toPrecision(3):Math.round(length))+" m<br/>"+
            "Weapon slots: "+shipClass.weaponSlots.length+"<br/>"+
            "Thrusters: "+shipClass.thrusterSlots.length;
        
        self.bindSceneToCanvas(self._scene,self.getScreenCanvas("databaseCanvas"));
        self._scene.activeCamera.setPositionMatrix(translationMatrix(0,0,-self._item.visualModel.getScaledSize()));
        self.startRenderLoop(1000/60);
        self.startRotationLoop();
    });
    
    game.graphicsContext.resourceManager.requestResourceLoad();
};

/**
 * Defines a graphics setting screen object.
 * @class Represents the graphics settings screen.
 * @extends GameScreen
 * @param {String} name @see GameScreen
 * @param {String} source @see GameScreen
 * @returns {GraphicsScreen}
 */
function GraphicsScreen(name,source) {
    GameScreen.call(this,name,source);
    
    this._antialiasingSelector = this.registerComponent(new Selector("aaSelector","selector.html","Anti-aliasing:",["on","off"]),"settingsDiv");
    this._filteringSelector = this.registerComponent(new Selector("filteringSelector","selector.html","Texture filtering:",["bilinear","trilinear","anisotropic"]),"settingsDiv");
    this._lodSelector = this.registerComponent(new Selector("lodSelector","selector.html","Model details:",["very low","low","medium","high","very high"]),"settingsDiv");
};

GraphicsScreen.prototype=new GameScreen();
GraphicsScreen.prototype.constructor=GraphicsScreen;

GraphicsScreen.prototype._initializeComponents = function() {
    GameScreen.prototype._initializeComponents.call(this);
    
    var self = this;
    var backButton = document.getElementById("backButton");
    backButton.addEventListener("click",function(){
        game.graphicsContext.setAntialiasing((self._antialiasingSelector.getSelectedValue()==="on"));
        game.graphicsContext.setFiltering(self._filteringSelector.getSelectedValue());
        game.graphicsContext.setMaxLOD(self._lodSelector.getSelectedIndex());
        if(self.isSuperimposed()) {
            game.closeSuperimposedScreen();
        } else {
            game.setCurrentScreen('settings');
        }
    });
    var defaultsButton = document.getElementById("defaultsButton");
    defaultsButton.addEventListener("click",function(){
        game.graphicsContext.restoreDefaults();
        self.updateValues();
    });
    
    this.updateValues();
};

GraphicsScreen.prototype.updateValues = function() {
    this._antialiasingSelector.selectValue((game.graphicsContext.getAntialiasing()===true)?"on":"off");
    this._filteringSelector.selectValue(game.graphicsContext.getFiltering());
    this._lodSelector.selectValueWithIndex(game.graphicsContext.getMaxLoadedLOD());
};

/**
 * Defines a controls screen object.
 * @class Represents the controls screen, where the user can set up the game
 * controls.
 * @extends GameScreen
 * @param {String} name @see GameScreen
 * @param {String} source @see GameScreen
 * @returns {ControlsScreen}
 */
function ControlsScreen(name,source) {
    GameScreen.call(this,name,source);
    
    /**
     * The name of the action currently being set (to get triggered by a new 
     * key). If null, the user is not setting any actions.
     * @name ControlScreen#_actionUnderSetting
     * @type String
     */
    this._actionUnderSetting = null;
    /**
     * While the user sets a new key, this property tells if shift is pressed
     * down.
     * @name ControlScreen#_settingShiftState
     * @type Boolean
     */
    this._settingShiftState = null;
    /**
     * While the user sets a new key, this property tells if control is pressed
     * down.
     * @name ControlScreen#_settingCtrlState
     * @type Boolean
     */
    this._settingCtrlState = null;
    /**
     * While the user sets a new key, this property tells if alt is pressed
     * down.
     * @name ControlScreen#_settingAltState
     * @type Boolean
     */
    this._settingAltState = null;
};

ControlsScreen.prototype=new GameScreen();
ControlsScreen.prototype.constructor=ControlsScreen;

/**
 * Refreshes the cell showing the currently set key for the given action in the
 * UI. (call after the key has changed)
 * @param {String} actionName
 */
ControlsScreen.prototype.refreshKeyForAction = function(actionName) {
    document.getElementById(actionName).innerHTML = game.controlContext.getKeyStringForAction(actionName);
    document.getElementById(actionName).className = "clickable";
};

/**
 * Handler for the keydown event to be active while the user is setting a new key
 * for an action. Updates the shift, control and alt states if one of those keys
 * is pressed, so that key combinations such as "ctrl + left" can be set.
 * @param {KeyboardEvent} event
 */
ControlsScreen.prototype.handleKeyDownWhileSetting = function(event) {
    if(event.keyCode===16) {
        this._settingShiftState = true;
    }
    if(event.keyCode===17) {
        this._settingCtrlState = true;
    }
    if(event.keyCode===18) {
        this._settingAltState = true;
    }
};

/**
 * Handler for the keyp event to be active while the user is setting a new key
 * for an action. This actually sets the key to the one that has been released,
 * taking into account the shift, control and alt states as well.
 * @param {KeyboardEvent} event
 */
ControlsScreen.prototype.handleKeyUpWhileSetting = function(event) {
    // if we released shift, ctrl or alt, update their state
    // (assigning shift, ctrl or alt as a single key to an action is not allowed
    // at the moment, as assigning them to a continuous action would break
    // functionality of other continuous actions that the user would wish to
    // apply simultaneously, since after the press the shift/ctrl/alt state
    // would be different)
    if(event.keyCode===16) {
        this._settingShiftState = false;
    } else if(event.keyCode===17) {
        this._settingCtrlState = false;
    } else if(event.keyCode===18) {
        this._settingAltState = false;
    } else {
    // if it was any other key, respect the shift, ctrl, alt states and set the
    // new key for the action
        game.controlContext.setAndStoreKeyBinding(new game.controlContext.KeyBinding(
            this._actionUnderSetting,
            KeyboardControlContext.prototype.getKeyOfCode(event.keyCode),
            this._settingShiftState,
            this._settingCtrlState,
            this._settingAltState
        ));
        this.stopKeySetting();
    }
};

/**
 * Cancels an ongoing key setting by updating the internal state, refreshing the
 * UI (cancelling highlight and restoring it to show the original key) and cancelling
 * key event handlers.
 */
ControlsScreen.prototype.stopKeySetting = function() {
    if(this._actionUnderSetting !== null) {
        this.refreshKeyForAction(this._actionUnderSetting);
        this._actionUnderSetting = null;
        document.onkeydown = null;
        document.onkeyup = null;
    }
};

/**
 * Starts setting a new key for an action. Highlights the passed element and
 * sets up the key event handlers to update the action represented by this
 * element.
 * @param {Element} tdElement
 */
ControlsScreen.prototype.startKeySetting = function(tdElement) {
    var actionName = tdElement.getAttribute("id");
    // if we are already in the process of setting this action, just cancel it,
    // so setting an action can be cancelled by clicking on the same cell again
    if(this._actionUnderSetting === actionName) {
        this.stopKeySetting();
    // otherwise cancel if we are in a process of setting another action, and 
    // then start setting this one
    } else {
        this.stopKeySetting();
        this._actionUnderSetting = actionName;
        tdElement.innerHTML = "?";
        tdElement.className = "highlightedItem";
        this._settingShiftState = false;
        this._settingCtrlState = false;
        this._settingAltState = false;
        var self = this;
        document.onkeydown = function(event) {
            self.handleKeyDownWhileSetting(event);
        };
        document.onkeyup = function(event) {
            self.handleKeyUpWhileSetting(event);
        };
    }
};

/**
 * Initializes the buttons and adds the table showing the current control settings.
 */
ControlsScreen.prototype._initializeComponents = function() {
    GameScreen.prototype._initializeComponents.call(this);
    
    var self = this;
    var backButton = document.getElementById("backButton");
    backButton.addEventListener("click",function(){
        self.stopKeySetting();
        if(game.getCurrentScreen().isSuperimposed()) {
            game.closeSuperimposedScreen();
        } else {
            game.setCurrentScreen('settings');
        }
    });
    var defaultsButton = document.getElementById("defaultsButton");
    defaultsButton.addEventListener("click",function(){
        self.stopKeySetting();
        game.controlContext.restoreDefaults();
        self.generateTable();
    });
    
    this.generateTable();
};

/**
 * Adds the table showing available actions and their assigned keys as well as
 * sets up a click handler for the cells showing the keys to initiate a change
 * of that key binding.
 */
ControlsScreen.prototype.generateTable = function() {
    var self = this;
    var keyBindingsTable = document.getElementById("keyBindingsTable");
    keyBindingsTable.innerHTML = "";
    var keyBindings = game.controlContext.getActionExplanationsAndKeys();
    var trElement = null;
    var td1Element = null;
    var td2Element = null;
    for(var i=0;i<keyBindings.length;i++) {
        trElement = document.createElement("tr");
        td1Element = document.createElement("td");
        td1Element.setAttribute("id",keyBindings[i].name);
        td1Element.className = "clickable";
        td1Element.onclick = function() { self.startKeySetting(this); };
        td1Element.innerHTML = keyBindings[i].key;
        td2Element = document.createElement("td");
        td2Element.innerHTML = keyBindings[i].description;
        trElement.appendChild(td1Element);
        trElement.appendChild(td2Element);
        keyBindingsTable.appendChild(trElement);
    }
};

/**
 * Defines a menu screen object.
 * @class A game screen with a {@link MenuComponent}.
 * @extends GameScreen
 * @param {String} name @see {@link GameScreen}
 * @param {String} source @see {@link GameScreen}
 * @param {Object[]} menuOptions The menuOptions for creating the {@link MenuComponent}
 * @param {String} [menuContainerID] The ID of the HTML element inside of which
 * the menu should be added (if omitted, it will be appended to body)
 * @returns {MenuScreen}
 */
function MenuScreen(name,source,menuOptions,menuContainerID) {
    GameScreen.call(this,name,source);
    
    /**
     * @see MenuComponent
     * @name MenuScreen#_menuOptions 
     * @type Object[]
     */
    this._menuOptions = menuOptions;
    /**
     * The ID of the HTML element inside of which the menu will be added. If
     * undefined, it will be appended to the document body.
     * @name MenuScreen#_menuContainerID 
     * @type String
     */
    this._menuContainerID = menuContainerID;
    /**
     * The component generating the HTML menu.
     * @name MenuScreen#_menuComponent 
     * @type MenuComponent
     */
    this._menuComponent = this.registerComponent(new MenuComponent("menu","menucomponent.html",this._menuOptions),this._menuContainerID);
};

MenuScreen.prototype=new GameScreen();
MenuScreen.prototype.constructor=MenuScreen;