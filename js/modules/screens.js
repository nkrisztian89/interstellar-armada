/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, document, alert, window, setInterval, clearInterval */

/**
 * @param types Used for handling enum values
 * @param application Used for logging and file loading functionality
 * @param asyncResource Screens are subclassed from AsyncResource as they are loaded from external XML files
 * @param components Screens contain components
 * @param managedGL Screens having canvases provide the managed GL contexts for them
 * @param resources Used to clear graphics resource bindings to contexts of removed screens
 * @param strings Used to offer translation support
 */
define([
    "utils/types",
    "modules/application",
    "modules/async-resource",
    "modules/components",
    "modules/managed-gl",
    "modules/graphics-resources",
    "modules/strings"
], function (types, application, asyncResource, components, managedGL, resources, strings) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            /*
             * The content of HTML elements with this class on the page will be automatically translated on every update, using
             * the key <name of the page> " <TRANSLATION_KEY_SEPARATOR> + <id of the element>
             * @type String
             */
            TRANSLATABLE_CLASS_NAME = "translatable",
            ELEMENT_ID_SEPARATOR = "_",
            TRANSLATION_KEY_SEPARATOR = ".";
    // #########################################################################
    /**
     * @class Holds the logical model of a screen of the game. The different
     * screens should be defined as descendants of this class.
     * @extends AsyncResource
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     */
    function HTMLScreen(name, source) {
        asyncResource.AsyncResource.call(this);
        /**
         * @type String
         */
        this._name = name;
        /**
         * @type String
         */
        this._source = source;
        /**
         * @type Document
         */
        this._model = null;
        /**
         * @type Element
         */
        this._background = null;
        /**
         * @type Element
         */
        this._container = null;
        /**
         * @type SimpleComponent[]
         */
        this._simpleComponents = [];
        /**
         * @type ExternalComponent[]
         */
        this._externalComponents = [];
        /**
         * @type Number
         */
        this._externalComponentsLoaded = 0;
        /**
         * @type Number
         */
        this._externalComponentsToLoad = 0;
        /**
         * @type Function
         * @returns undefined
         */
        this._onModelLoad = function () {
            application.log("Model of the screen '" + this._name + "' has been loaded, with no onModelLoad handler set.", 2);
        };
        // source will be undefined when setting the prototypes for inheritance
        if (source !== undefined) {
            this.requestModelLoad();
        }
    }
    HTMLScreen.prototype = new asyncResource.AsyncResource();
    HTMLScreen.prototype.constructor = HTMLScreen;
    /**
     * Initiates the asynchronous loading of the screen's structure from the
     * external HTML file.
     */
    HTMLScreen.prototype.requestModelLoad = function () {
        // send an asynchronous request to grab the HTML file containing the DOM of
        // this screen
        application.requestTextFile("screen", this._source, function (responseText) {
            this._model = document.implementation.createHTMLDocument(this._name);
            this._model.documentElement.innerHTML = responseText;
            this._onModelLoad();
            if (this._externalComponentsLoaded === this._externalComponentsToLoad) {
                this.setToReady();
            }
        }.bind(this));
    };
    /**
     * Getter for the _name property.
     * @returns {String}
     */
    HTMLScreen.prototype.getName = function () {
        return this._name;
    };
    /**
     * Replaces the current HTML page's body with the sctructure of the screen.
     * @param {Function} callback
     */
    HTMLScreen.prototype.replacePageWithScreen = function (callback) {
        document.body.innerHTML = "";
        this.addScreenToPage(callback);
    };
    /**
     * Appends the content of the screen to the page in an invisible (display: none) div.
     * @param {Function} callback
     */
    HTMLScreen.prototype.addScreenToPage = function (callback) {
        this.executeWhenReady(function () {
            var namedElements, i;
            this._background = document.createElement("div");
            this._background.setAttribute("id", this._name + "PageBackground");
            this._background.className = "fullScreenFix";
            this._background.style.display = "none";
            this._container = document.createElement("div");
            this._container.setAttribute("id", this._name + "PageContainer");
            this._container.className = "fullScreenContainer";
            this._container.style.display = "none";
            this._container.innerHTML = this._model.body.innerHTML;
            namedElements = this._container.querySelectorAll("[id]");
            for (i = 0; i < namedElements.length; i++) {
                namedElements[i].setAttribute("id", this._name + ELEMENT_ID_SEPARATOR + namedElements[i].getAttribute("id"));
            }
            document.body.appendChild(this._background);
            document.body.appendChild(this._container);
            this._initializeComponents();
            if (callback) {
                callback();
            }
        });
    };
    /**
     * Displays the screen (makes it visible)
     */
    HTMLScreen.prototype.show = function () {
        this.executeWhenReady(function () {
            this._container.style.display = "block";
        });
    };
    /**
     * Superimposes the screen on the current page, by appending a full screen
     * container and the screen structure as its child inside it.
     * @param {Number[4]} backgroundColor The color of the full screen background. ([r,g,b,a],
     * where all color components should be 0-1)
     */
    HTMLScreen.prototype.superimposeOnPage = function (backgroundColor) {
        this.executeWhenReady(function () {
            this._background.style.backgroundColor = "rgba(" +
                    Math.round(backgroundColor[0] * 255) + "," +
                    Math.round(backgroundColor[1] * 255) + "," +
                    Math.round(backgroundColor[2] * 255) + "," +
                    backgroundColor[3] + ")";
            this._background.style.display = "block";
            document.body.appendChild(this._background);
            document.body.appendChild(this._container);
            this.show();
        });
    };
    /**
     * Hides the screen (makes it invisible and not take any screen space)
     */
    HTMLScreen.prototype.hide = function () {
        this.executeWhenReady(function () {
            this._container.style.display = "none";
            this._background.style.display = "none";
        });
    };
    /**
     * Tells whether the screen is superimposed on top of another one.
     * @returns {Boolean}
     */
    HTMLScreen.prototype.isSuperimposed = function () {
        return this._background.style.display !== "none";
    };
    /**
     * Executes the necessary actions required when closing the page. This method
     * only nulls out the default components, additional functions need to be added
     * in the descendant classes.
     */
    HTMLScreen.prototype.removeFromPage = function () {
        var i;
        for (i = 0; i < this._simpleComponents.length; i++) {
            this._simpleComponents[i].resetComponent();
        }
        for (i = 0; i < this._externalComponents.length; i++) {
            this._externalComponents[i].component.resetComponent();
        }
        document.body.removeChild(this._background);
        document.body.removeChild(this._container);
        this._background = null;
        this._container = null;
    };
    /**
     * Setting the properties that will be used to easier access DOM elements later.
     * In descendants, this method should be overwritten, adding the additional
     * components of the screen after calling this parent method.
     */
    HTMLScreen.prototype._initializeComponents = function () {
        var i, parentNode;
        for (i = 0; i < this._simpleComponents.length; i++) {
            this._simpleComponents[i].initComponent();
        }
        for (i = 0; i < this._externalComponents.length; i++) {
            if (this._externalComponents[i].parentNodeID !== undefined) {
                parentNode = document.getElementById(this._name + "_" + this._externalComponents[i].parentNodeID);
            }
            // otherwise just leave it undefined, nothing to pass to the method below
            this.addExternalComponent(this._externalComponents[i].component, parentNode);
        }
        this._updateComponents();
    };
    /**
     * @param {Element} element
     * @returns {String}
     */
    HTMLScreen.prototype._getOriginalElementID = function (element) {
        return element.getAttribute("id").substr(this._name.length + ELEMENT_ID_SEPARATOR.length);
    };
    /**
     * Override this and add the code update the state of components on this screen to be up-to-date with the
     * application state. This basic method automatically translated the content of all elements having the
     * TRANSLATABLE_CLASS_NAME class.
     */
    HTMLScreen.prototype._updateComponents = function () {
        var translatableElements, i;
        application.log("Screen '" + this._name + "' is getting updated.", 2);
        translatableElements = this._container.querySelectorAll("." + TRANSLATABLE_CLASS_NAME);
        for (i = 0; i < translatableElements.length; i++) {
            translatableElements[i].innerHTML = strings.get({
                name: this._name + TRANSLATION_KEY_SEPARATOR + this._getOriginalElementID(translatableElements[i]),
                defaultValue: translatableElements[i].innerHTML
            });
        }
        for (i = 0; i < this._externalComponents.length; i++) {
            this._externalComponents[i].component.updateComponents();
        }
    };
    /**
     * Updates all components on this screen to be up-to-date with the application state.
     */
    HTMLScreen.prototype.updateScreen = function () {
        this._updateComponents();
    };
    /**
     * @param {String} simpleComponentName
     * @returns {SimpleComponent}
     */
    HTMLScreen.prototype.registerSimpleComponent = function (simpleComponentName) {
        var component = new components.SimpleComponent(this._name + ELEMENT_ID_SEPARATOR + simpleComponentName);
        this._simpleComponents.push(component);
        return component;
    };
    /**
     * @param {ExternalComponent} screenComponent
     * @param {String} parentNodeID
     * @returns {ExternalComponent}
     */
    HTMLScreen.prototype.registerExternalComponent = function (screenComponent, parentNodeID) {
        this._externalComponentsToLoad++;
        this._externalComponents.push({
            component: screenComponent,
            parentNodeID: parentNodeID
        });
        screenComponent.executeWhenReady(function () {
            this._externalComponentsLoaded++;
            if (this._model && (this._externalComponentsLoaded === this._externalComponentsToLoad)) {
                this.setToReady();
            }
        }.bind(this));
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
    HTMLScreen.prototype.addExternalComponent = function (screenComponent, parentNode) {
        screenComponent.appendToPage(parentNode);
        return screenComponent;
    };
    /**
     * Provides visual information to the user about the current status of the application.
     * @param {String} newStatus The new status to display.
     */
    HTMLScreen.prototype.updateStatus = function (newStatus) {
        if (this._status !== null) {
            this._status.setContent(newStatus);
        } else {
            alert(newStatus);
        }
    };
    // #########################################################################
    /**
     * @class An enhanced canvas element (a wrapper around a regular HTML canvas), 
     * that can create and hold a reference to a managed WebGL context for the canvas.
     * @param {HTMLCanvasElement} canvas The canvas around which this object should
     * be created.
     * @param {Boolean} antialiasing Whether antialiasing should be turned on for the GL context of this canvas
     * @param {String} filtering (enum managedGL.TextureFiltering) What texture filtering mode to use when rendering to this canvas
     * @returns {ScreenCanvas}
     */
    function ScreenCanvas(canvas, antialiasing, filtering) {
        /**
         * @type HTMLCanvasElement
         */
        this._canvas = canvas;
        /**
         * @type String
         */
        this._name = canvas.getAttribute("id");
        /**
         * @type Boolean
         */
        this._resizeable = canvas.classList.contains("resizeable");
        /**
         * @type Boolean
         */
        this._antialiasing = antialiasing;
        /**
         * enum managedGL.TextureFiltering
         * @type String
         */
        this._filtering = types.getEnumValue("canvas.filtering", managedGL.TextureFiltering, filtering);
        /**
         * @type ManagedGLContext
         */
        this._context = null;
    }
    /**
     * Returns the stored HTML canvas element.
     * @returns {HTMLCanvasElement}
     */
    ScreenCanvas.prototype.getCanvasElement = function () {
        return this._canvas;
    };
    /**
     * Tells if the canvas is resizeable = if it has a dynamic size that changes
     * when the window is resized.
     * @returns {Boolean}
     */
    ScreenCanvas.prototype.isResizeable = function () {
        return this._resizeable;
    };
    /**
     * Returns a managed WebGL context created for the canvas. It creates the 
     * context if it does not exist yet.
     * @returns {ManagedGLContext}
     */
    ScreenCanvas.prototype.getManagedContext = function () {
        if (this._context === null) {
            this._context = new managedGL.ManagedGLContext(this._canvas.getAttribute("id"), this._canvas, this._antialiasing, this._filtering);
        }
        return this._context;
    };
    // #########################################################################
    /**
     * @class Represents a game screen that has one or more canvases where WebGL
     * scenes can be rendered.
     * @extends HTMLScreen
     * @param {String} name The name by which this screen can be identified.
     * @param {String} source The name of the HTML file where the structure of this
     * screen is defined.
     * @param {Boolean} antialiasing Whether antialiasing should be turned on for the GL contexts of the canvases of this screen
     * @param {String} filtering (enum managedGL.TextureFiltering) What texture filtering mode to use when rendering to a canvas of this screen
     */
    function HTMLScreenWithCanvases(name, source, antialiasing, filtering) {
        HTMLScreen.call(this, name, source);
        /**
         * @type Boolean
         */
        this._antialiasing = antialiasing;
        /**
         * enum managedGL.TextureFiltering
         * @type String
         */
        this._filtering = source ? types.getEnumValue("HTMLScreenWithCanvases.filtering", managedGL.TextureFiltering, filtering) : null;
        /**
         * @type Object.<String, ScreenCanvas>
         */
        this._canvases = {};
        /**
         * @typedef {Object} ScreenCanvasBinding
         * @property {Scene} scene
         * @property {ScreenCanvas} canvas
         */
        /**
         * @type ScreenCanvasBinding[]
         */
        this._sceneCanvasBindings = [];
        /**
         * @type Number
         */
        this._renderLoop = null;
        /**
         * @type Date[]
         */
        this._renderTimes = null;
        /**
         * @type Function
         */
        this._resizeEventListener = null;
    }
    HTMLScreenWithCanvases.prototype = new HTMLScreen();
    HTMLScreenWithCanvases.prototype.constructor = HTMLScreenWithCanvases;
    /**
     * Removes all stored binding between scenes and canvases. This removes all references to the related scenes existing in this object.
     */
    HTMLScreenWithCanvases.prototype.clearSceneCanvasBindings = function () {
        this._sceneCanvasBindings = [];
    };
    /**
     * @override
     * Stops the render loop and nulls out the components.
     */
    HTMLScreenWithCanvases.prototype.removeFromPage = function () {
        HTMLScreen.prototype.removeFromPage.call(this);
        this.stopRenderLoop();
        window.removeEventListener("resize", this._resizeEventListener);
        this._resizeEventListener = null;
        this._canvases = {};
        this.clearSceneCanvasBindings();
        resources.clearResourceContextBindings();
    };
    /**
     * @override
     * Stops the render loops next to hiding the page.
     */
    HTMLScreenWithCanvases.prototype.hide = function () {
        HTMLScreen.prototype.hide.call(this);
        this.stopRenderLoop();
    };
    /**
     * Initializes the components of the parent class, then the additional ones for
     * this class (the canvases).
     */
    HTMLScreenWithCanvases.prototype._initializeComponents = function () {
        var canvasElements, i;
        HTMLScreen.prototype._initializeComponents.call(this);
        canvasElements = document.getElementsByTagName("canvas");
        for (i = 0; i < canvasElements.length; i++) {
            this._canvases[canvasElements[i].getAttribute("id")] = new ScreenCanvas(canvasElements[i], this._antialiasing, this._filtering);
        }
        this._resizeEventListener = function () {
            this.resizeCanvases();
        }.bind(this);
        window.addEventListener("resize", this._resizeEventListener);
    };
    /**
     * Returns the stored canvas component that has the passed name.
     * @param {String} name
     * @returns {ScreenCanvas}
     */
    HTMLScreenWithCanvases.prototype.getScreenCanvas = function (name) {
        return this._canvases[this._name + "_" + name];
    };
    /**
     * Creates a binding between the passed scene and canvas, causing the scene to
     * be rendered on the canvas automatically in the render loop of this screen.
     * @param {Scene} scene
     * @param {ScreenCanvas} canvas
     */
    HTMLScreenWithCanvases.prototype.bindSceneToCanvas = function (scene, canvas) {
        var alreadyBound = false, i;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            if (
                    (this._sceneCanvasBindings[i].scene === scene) &&
                    (this._sceneCanvasBindings[i].canvas === canvas)) {
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
        if (this._renderLoop !== null) {
            canvas.getManagedContext().setup();
        }
    };
    /**
     * Renders the scenes displayed on this screen.
     */
    HTMLScreenWithCanvases.prototype.render = function () {
        var i, d, dt;
        d = new Date();
        dt = (this._renderTimes && (this._renderTimes.length > 0)) ? (d - this._renderTimes[this._renderTimes.length - 1]) : 0;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].scene.cleanUp();
            this._sceneCanvasBindings[i].scene.render(this._sceneCanvasBindings[i].canvas.getManagedContext(), dt);
        }
        if (this._renderLoop !== null) {
            this._renderTimes.push(d);
            while ((this._renderTimes.length > 1) && ((d - this._renderTimes[0]) > 1000)) {
                this._renderTimes.shift();
            }
        }
    };
    /**
     * Starts the render loop, by beginning to execute the render function every
     * interval milliseconds.
     * @param {Number} interval
     */
    HTMLScreenWithCanvases.prototype.startRenderLoop = function (interval) {
        var i;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].canvas.getManagedContext().setup();
        }
        this._renderTimes = [new Date()];
        this._renderLoop = setInterval(function () {
            this.render();
        }.bind(this), interval);
    };
    /**
     * Stops the render loop.
     */
    HTMLScreenWithCanvases.prototype.stopRenderLoop = function () {
        clearInterval(this._renderLoop);
        this._renderLoop = null;
    };
    /**
     * Returns the Frames Per Second count for this screen's render loop.
     * @returns {Number}
     */
    HTMLScreenWithCanvases.prototype.getFPS = function () {
        return this._renderTimes.length;
    };
    /**
     * Updates the size of the HTMLCanvasElement associated with the ScreenCanvas contained in this screen with the passed name and all its
     * bound scenes to match the current display size
     * @param {String} name
     */
    HTMLScreenWithCanvases.prototype.resizeCanvas = function (name) {
        var i,
                canvasElement = this._canvases[name].getCanvasElement(),
                width = canvasElement.clientWidth,
                height = canvasElement.clientHeight;
        if (canvasElement.width !== width ||
                canvasElement.height !== height) {
            // Change the size of the canvas to match the size it's being displayed
            canvasElement.width = width;
            canvasElement.height = height;
        }
        // updated the variables in the scenes
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            if (this._sceneCanvasBindings[i].canvas === this._canvases[name]) {
                this._sceneCanvasBindings[i].scene.resizeViewport(
                        canvasElement.width,
                        canvasElement.height);
            }
        }
    };
    /**
     * Updates all needed variables when the screen is resized (camera perspective
     * matrices as well)
     */
    HTMLScreenWithCanvases.prototype.resizeCanvases = function () {
        var canvasName;
        // first, update the canvas width and height properties if the client width/
        // height has changed
        for (canvasName in this._canvases) {
            if (this._canvases.hasOwnProperty(canvasName)) {
                if (this._canvases[canvasName].isResizeable() === true) {
                    this.resizeCanvas(canvasName);
                }
            }
        }
    };
    // #########################################################################
    /**
     * @class A game screen with a {@link MenuComponent}.
     * @extends HTMLScreen
     * @param {String} name See {@link GameScreen}
     * @param {String} source See {@link GameScreen}
     * @param {MenuComponent~MenuOption[]} menuOptions The menuOptions for creating the {@link MenuComponent}
     * @param {String} [menuContainerID] The ID of the HTML element inside of which
     * the menu should be added (if omitted, it will be appended to body)
     */
    function MenuScreen(name, source, menuOptions, menuContainerID) {
        HTMLScreen.call(this, name, source);
        /**
         * @type MenuComponent~MenuOption[]
         */
        this._menuOptions = menuOptions;
        /**
         * The ID of the HTML element inside of which the menu will be added. If
         * undefined, it will be appended to the document body.
         * @type String
         */
        this._menuContainerID = menuContainerID;
        /**
         * The component generating the HTML menu.
         * @type MenuComponent
         */
        this._menuComponent = this.registerExternalComponent(new components.MenuComponent(name + "_menu", "menucomponent.html", this._menuOptions), this._menuContainerID);
    }
    MenuScreen.prototype = new HTMLScreen();
    MenuScreen.prototype.constructor = MenuScreen;
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ELEMENT_ID_SEPARATOR: ELEMENT_ID_SEPARATOR,
        HTMLScreen: HTMLScreen,
        HTMLScreenWithCanvases: HTMLScreenWithCanvases,
        MenuScreen: MenuScreen
    };
});