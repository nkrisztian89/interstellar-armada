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
 * Defines a screen component object.
 * @class A reusable component that consist of HTML elements (a fragment of a 
 * HTML document) and can be appended to game screens. Various components have
 * to be the descendants of this class, and implement their own various methods.
 * @extends Resource
 * @param {String} name The name of the component to be identified by.
 * @param {String} source The filename of the HTML document where the structure
 * of the component should be defined. The component will be loaded as the first
 * element (and all its children) inside the body tag of this file.
 * @returns {ScreenComponent}
 */
function ScreenComponent(name,source) {
    Resource.call(this);
    
    this._name=name;
    this._source=source;
    
    this._model=null;
    
    this._rootElement = null;
    this._rootElementDefaultDisplayMode = null;
    
    // function to execute when the model is loaded
    this._onModelLoad = function() {};
    
    // source will be undefined when setting the prototypes for inheritance
    if(source!==undefined) {
        this.requestModelLoad();
    }
}

ScreenComponent.prototype = new Resource();
ScreenComponent.prototype.constructor = ScreenComponent;

/**
 * Initiates the asynchronous loading of the component's structure from the
 * external HTML file.
 */
ScreenComponent.prototype.requestModelLoad = function() {
    // send an asynchronous request to grab the XML file containing the DOM of
    // this component
    var request = new XMLHttpRequest();
    request.open('GET', location.pathname+this._source+"?123", true);
    var self = this;
    request.onreadystatechange = function() {
            if(request.readyState===4) {
                self._model = document.implementation.createHTMLDocument(self._name);
                self._model.documentElement.innerHTML = this.responseText;
                self._onModelLoad();
            }
        };
    request.send(null);
};

/**
 * Appends the component's elements to the current document.
 */
ScreenComponent.prototype.appendToPage = function() {
    var self = this;
    var appendToPageFunction = function() {
        self._rootElement = document.body.appendChild(document.importNode(self._model.body.firstElementChild,true));
        self._rootElementDefaultDisplayMode = self._rootElement.style.display;
        self._initializeComponents();
        self.setToReady();
    };
    // if we have built up the model of the screen already, then load it
    if(this._model!==null) {
        appendToPageFunction();
    // if not yet, set the callback function which fires when the model is 
    // loaded
    } else {
        this._onModelLoad = appendToPageFunction;
    }
};

/**
 * Setting the properties that will be used to easier access DOM elements later.
 * In descendants, this method should be overwritten, adding the additional
 * components of the screen after calling this parent method.
 */
ScreenComponent.prototype._initializeComponents = function() {
};

/**
 * Sets the display property of the root element of the component to show it.
 */
ScreenComponent.prototype.show = function() {
    var self = this;
    this.executeWhenReady(function() {
        self._rootElement.style.display = this._rootElementDefaultDisplayMode;
    });
};

/**
 * Sets the display property of the root element of the component to hide it.
 */
ScreenComponent.prototype.hide = function() {
    var self = this;
    this.executeWhenReady(function() {
        self._rootElement.style.display = "none";
    });
};

/**
 * Defines a loading box component object.
 * @class A loading box component, that has a title, a progress bar and a status
 * message and appears in the middle of the screen (the corresponding stylesheet 
 * needs to be statically referenced in the head of index.html as of now)
 * @extends ScreenComponent
 * @param {String} name Check ScreenComponent
 * @param {String} source Check ScreenComponent
 * @returns {LoadingBox}
 */
function LoadingBox(name,source) {
    ScreenComponent.call(this,name,source);
    
    this._progress = null;
    this._status = null;
}

LoadingBox.prototype = new ScreenComponent();
LoadingBox.prototype.constructor = LoadingBox;

/**
 * Sets the properties for easier access of the DOM elements.
 */
LoadingBox.prototype._initializeComponents = function() {
    ScreenComponent.prototype._initializeComponents.call(this);
    
    this._progress = this._rootElement.querySelector("progress.loadingBoxProgress");
    this._status = this._rootElement.querySelector("p.loadingBoxStatus");
};

/**
 * Updates the value of the progress bar shown on the loading box.
 * @param {Number} value The new value of the progress bar.
 */
LoadingBox.prototype.updateProgress= function(value) {
    var self = this;
    this.executeWhenReady(function() {
        self._progress.value = value;
    });
};

/**
 * Updates the status message shown on the loading box.
 * @param {String} status The new status to show.
 */
LoadingBox.prototype.updateStatus= function(status) {
    var self = this;
    this.executeWhenReady(function() {
        self._status.innerHTML = status;
    });
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
 * Executes the necessary actions required when closing the page. This method
 * only nulls out the default components, additional functions need to be added
 * in the descendant classes.
 */
GameScreen.prototype.closePage = function() {
    this._status = null;
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
 * Appends the elements of an external component (a HTML document fragment
 * defined in an external xml file) to the DOM tree and returns the same 
 * component.
 * @param {ScreenComponent} screenComponent
 * @returns {ScreenComponent}
 */
GameScreen.prototype.addExternalComponent = function(screenComponent) {
    screenComponent.appendToPage();
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
    
    this._fixCanvases=null;
    this._resizeableCanvases=null;
    
    this._scenes=new Array();
    
    this._renderLoop = null;
};

GameScreenWithCanvases.prototype=new GameScreen();
GameScreenWithCanvases.prototype.constructor=GameScreenWithCanvases;

/**
 * Stops the render loop and nulls out the components.
 */
GameScreenWithCanvases.prototype.closePage = function() {
    GameScreen.prototype.closePage.call(this);
    
    this.stopRenderLoop();
    
    this._fixCanvases = null;
    this._resizeableCanvases = null;
};

/**
 * Initializes the components of the parent class, then the additional ones for
 * this class (the canvases).
 */
GameScreenWithCanvases.prototype._initializeComponents = function() {
    GameScreen.prototype._initializeComponents.call(this);
    
    this._fixCanvases = document.querySelectorAll("canvas.fix");
    this._resizeableCanvases= document.querySelectorAll("canvas.resizeable");
    
    var self = this;
    this._model.body.onresize = self.resizeCanvases;
};

/**
 * Adds a WebGL scene that can be rendered to the canvases. This has to be set
 * in the render method.
 * @param {Scene} scene
 */
GameScreenWithCanvases.prototype.addScene = function(scene) {
    this._scenes.push(scene);
};

/**
 * The render function that needs to be described in the descendant classes.
 */
GameScreenWithCanvases.prototype.render = function() {
};

/**
 * Starts the render loop, by beginning to execute the render function every
 * interval milliseconds.
 * @param {Number} interval
 */
GameScreenWithCanvases.prototype.startRenderLoop = function(interval) {
    var self = this;
    this._renderLoop = setInterval(self.render,interval);
};

/**
 * Stops the render loop.
 */
GameScreenWithCanvases.prototype.stopRenderLoop = function() {
    clearInterval(this._renderLoop);
};

/**
 * If there is only one canvas, returns is.
 * @returns {Element}
 */
GameScreenWithCanvases.prototype.getCanvas = function() {
    if((this._fixCanvases.length===1)&&(this._resizeableCanvases.length===0)) {
        return this._fixCanvases[0];
    } else if((this._fixCanvases.length===0)&&(this._resizeableCanvases.length===1)) {
        return this._resizeableCanvases[0];
    } else {
        game.showError("Screen '"+this._name+"' has zero or more than one canvases, cannot return one!");
        return null;
    }
};

/**
 * Updates all needed variables when the screen is resized (camera perspective
 * matrices as well!)
 */
GameScreenWithCanvases.prototype.resizeCanvases = function() {
    var i;
    // first, update the canvas width and height properties if the client width/
    // height has changed
    for (i = 0; i < this._resizeableCanvases.length; i++) {
        var width = this._resizeableCanvases[i].clientWidth;
        var height = this._resizeableCanvases[i].clientHeight;
        if (this._resizeableCanvases[i].width !== width ||
                this._resizeableCanvases[i].height !== height) {
            // Change the size of the canvas to match the size it's being displayed
            this._resizeableCanvases[i].width = width;
            this._resizeableCanvases[i].height = height;
        }
    }
    // updated the variables in the scenes
    for (i = 0; i < this._scenes.length; i++) {
        this._scenes[i].resizeViewport();
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
};

BattleScreen.prototype=new GameScreenWithCanvases();
BattleScreen.prototype.constructor=BattleScreen;

/**
 * Initializes the components of the parent class, then the additional ones for
 * this class.
 */
BattleScreen.prototype._initializeComponents = function() {
    GameScreenWithCanvases.prototype._initializeComponents.call(this);
    
    this._stats = document.getElementById("stats");
    this._ui= document.getElementById("ui");
    
    this._loadingBox = this.addExternalComponent(new LoadingBox("loadingBox","loadingbox.html"));
};

/**
 * Getter for the _loadingBox property.
 * @returns {LoadingBox}
 */
BattleScreen.prototype.getLoadingBox = function() {
    return this._loadingBox;
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
 * Defines a help screen object.
 * @class Represents the help screen, which currently just shows the available
 * keyboard controls.
 * @extends GameScreen
 * @param {String} name Check GameScreen
 * @param {String} source Check GameScreen
 * @returns {HelpScreen}
 */
function HelpScreen(name,source) {
    GameScreen.call(this,name,source);
};

HelpScreen.prototype=new GameScreen();
HelpScreen.prototype.constructor=HelpScreen;

/**
 * Builds the dynamic part of the HTML structure, adding the table rows to list
 * the set key commands.
 */
HelpScreen.prototype._initializeComponents = function() {
    GameScreen.prototype._initializeComponents.call(this);
    
    var keyCommandsTable = document.getElementById("keyCommandsTable");
    var keyCommands = game.controlContext.getCommandExplanationsAndKeys();
    var trElement = null;
    for(var i=0;i<keyCommands.length;i++) {
        trElement = document.createElement("tr");
        trElement.innerHTML="<td>"+keyCommands[i][1]+"</td><td>"+keyCommands[i][0]+"</td>";
        keyCommandsTable.appendChild(trElement);
    }
};