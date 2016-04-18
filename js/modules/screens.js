/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides wrapper classes that can be used to manage (loading, assemblin, displaying, hiding, translating...) HTML based screens for
 * an application.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, document, alert, window, setInterval, clearInterval, performance */

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
            SCREEN_FOLDER = "screen",
            CSS_FOLDER = "css",
            /*
             * The content of HTML elements with this class on the page will be automatically translated on every update, using
             * the key <name of the page> " <TRANSLATION_KEY_SEPARATOR> + <id of the element>
             * @type String
             */
            TRANSLATABLE_CLASS_NAME = "translatable",
            ELEMENT_ID_SEPARATOR = components.ELEMENT_ID_SEPARATOR,
            TRANSLATION_KEY_SEPARATOR = ".",
            SCREEN_BACKGROUND_ID = "screenBackground",
            DEFAULT_SCREEN_BACKGROUND_CLASS_NAME = "screenBackground",
            SCREEN_CONTAINER_ID = "screenContainer",
            DEFAULT_SCREEN_CONTAINER_CLASS_NAME = "screenContainer",
            RESIZEABLE_CLASS_NAME = "resizeable",
            LOOP_CANCELED = -1,
            LOOP_REQUESTANIMFRAME = -2,
            MENU_COMPONENT_NAME = "menu",
            ANTIALIASING_CHANGE_ERROR_STRING = {
                name: "error.antialiasingChange",
                defaultValue: "The antialiasing setting has been changed. Please restart the application to apply the new setting!"
            };
    // #########################################################################
    /**
     * @typedef {Object} HTMLScreen~Style
     * A style descriptor for an screen storing the name of the CSS file
     * associated with the component as well as class names for dynamically created
     * HTML elements.
     * @property {String} cssFilename
     * @property {String} backgroundClassName
     * @property {String} containerClassName
     */
    /**
     * @typedef {Object} HTMLScreen~ExternalComponentBinding
     * @property {ExternalComponent} component
     * @property {String} parentNodeID
     */
    /**
     * @class Holds the logical model of a screen of the game. The different
     * screens should be defined as descendants of this class.
     * @extends AsyncResource
     * @param {String} name The name by which this screen can be identified. Needs to be
     * unique within the same application (ScreenManager). The ID of HTML elements belonging
     * to this screen will be prefixed by this name.
     * @param {String} htmlFilename The name of the HTML file where the structure of this
     * screen is defined.
     * @param {HTMLScreen~Style} [style] The object storing the styling information for this
     * screen.
     */
    function HTMLScreen(name, htmlFilename, style) {
        asyncResource.AsyncResource.call(this);
        /**
         * An ID of this screen. The IDs of HTML elements on this screen are prefixed by this name.
         * @type String
         */
        this._name = name;
        /**
         * The name of the HTML file that stores the source for this page.
         * @type String
         */
        this._htmlFilename = htmlFilename;
        /**
         * An object storing the name of the CSS file that contains the styling rules and for this 
         * components and the desired classes for dynamically created elements.
         * @type HTMLScreen~Style
         */
        this._style = style || {};
        /**
         * A flag that marks whether loading the correspoding CSS stylesheet has finished.
         * @type Boolean
         */
        this._cssLoaded = false;
        /**
         * Stores the model of the screen's DOM structure after it has been loaded and is automatically
         * cleared (unless explicitly specified otherwise) when the screen is added to the page.
         * @type HTMLDocument
         */
        this._model = null;
        /**
         * An HTML element that serves as a background for this page, and is added below the main container
         * of the screen when that is loaded.
         * @type Element
         */
        this._background = null;
        /**
         * The DOM structure of the screen is added inside this container element.
         * @type Element
         */
        this._container = null;
        /**
         * Stores the list of simple components (wrapped HTML elements) on this screen.
         * @type SimpleComponent[]
         */
        this._simpleComponents = [];
        /**
         * Stores the list of external components (components with their own DOM structure loaded
         * from external HTML files) on this screen.
         * @type HTMLScreen~ExternalComponentBinding[]
         */
        this._externalComponentBindings = [];
        /**
         * The number of external components on this page the source files of which have already been loaded.
         * @type Number
         */
        this._externalComponentsLoaded = 0;
        /**
         * The total number of external components on this screen the source files of which have to be loaded.
         * @type Number
         */
        this._externalComponentsToLoad = 0;
        // will be undefined when setting the prototypes for inheritance
        if (htmlFilename) {
            this.requestModelLoad();
        }
    }
    HTMLScreen.prototype = new asyncResource.AsyncResource();
    HTMLScreen.prototype.constructor = HTMLScreen;
    /**
     * Returns whether all external resources needed for this page have already been loaded.
     * @returns {Boolean}
     */
    HTMLScreen.prototype._isLoaded = function () {
        return this._model && this._cssLoaded && (this._externalComponentsLoaded === this._externalComponentsToLoad);
    };
    /**
     * Initiates the asynchronous loading of the screen's structure and style from the
     * external HTML and and CSS files.
     */
    HTMLScreen.prototype.requestModelLoad = function () {
        // send an asynchronous request to grab the HTML file containing the DOM of this screen
        application.requestTextFile(SCREEN_FOLDER, this._htmlFilename, function (responseText) {
            this._model = document.implementation.createHTMLDocument(this._name);
            this._model.documentElement.innerHTML = responseText;
            if (this._isLoaded()) {
                this.setToReady();
            }
        }.bind(this));
        // send a request to load the stylesheet, if needed
        if (this._style.cssFilename) {
            this._cssLoaded = false;
            application.requestCSSFile(CSS_FOLDER, this._style.cssFilename, function () {
                this._cssLoaded = true;
                if (this._isLoaded()) {
                    this.setToReady();
                }
            }.bind(this));
        } else {
            this._cssLoaded = true;
        }
    };
    /**
     * Returns the name of this screen.
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
     * If some source files for the screen have not been loaded yet, than sets a callback to append the 
     * screen once all necessary files have been loaded.
     * @param {Function} [callback] This function will be called after the screen has been added to the page.
     * @param {Boolean} [keepModelAfterAdding=false] Whether to keep storing the original DOM model
     * of the screen after adding it to the current document (so that it can be added again later)
     * @param {Element} [parentNode=document.body] If given, the screen and its background will be added as
     * children of this DOM node.
     */
    HTMLScreen.prototype.addScreenToPage = function (callback, keepModelAfterAdding, parentNode) {
        parentNode = parentNode || document.body;
        this.executeWhenReady(function () {
            var namedElements, i;
            this._background = document.createElement("div");
            this._background.setAttribute("id", this._getElementID(SCREEN_BACKGROUND_ID));
            this._background.className = this._style.backgroundClassName || DEFAULT_SCREEN_BACKGROUND_CLASS_NAME;
            this._background.style.display = "none";
            this._container = document.createElement("div");
            this._container.setAttribute("id", this._getElementID(SCREEN_CONTAINER_ID));
            this._container.className = this._style.containerClassName || DEFAULT_SCREEN_CONTAINER_CLASS_NAME;
            this._container.style.display = "none";
            this._container.innerHTML = this._model.body.innerHTML;
            namedElements = this._container.querySelectorAll("[id]");
            for (i = 0; i < namedElements.length; i++) {
                namedElements[i].setAttribute("id", this._getElementID(namedElements[i].getAttribute("id")));
            }
            parentNode.appendChild(this._background);
            parentNode.appendChild(this._container);
            this._initializeComponents();
            if (callback) {
                callback();
            }
            if (!keepModelAfterAdding) {
                this._model = null;
            }
        });
    };
    /**
     * Displays the screen (makes it visible)
     */
    HTMLScreen.prototype.show = function () {
        if (this._container) {
            this._container.style.display = "block";
        } else {
            application.showError("Attempting to show screen '" + this._name + "' before adding it to the page!");
        }
    };
    /**
     * Superimposes the screen on the current page, by appending a full screen
     * container and the screen structure as its child inside it.
     * @param {Number[4]} [backgroundColor] The color of the page background will be overriden by this
     * color, if given.([r,g,b,a], where all color components should be 0-1)
     * @param {Element} [parentNode=document.body] If given, the screen and its background will be set as
     * children of this DOM node.
     */
    HTMLScreen.prototype.superimposeOnPage = function (backgroundColor, parentNode) {
        if (this._container && this._background) {
            if (backgroundColor) {
                this._background.style.backgroundColor = "rgba(" +
                        Math.round(backgroundColor[0] * 255) + "," +
                        Math.round(backgroundColor[1] * 255) + "," +
                        Math.round(backgroundColor[2] * 255) + "," +
                        backgroundColor[3] + ")";
            }
            this._background.style.display = "block";
            parentNode = parentNode || document.body;
            // appendChild does not clone the element if it is already part of the DOM, in that
            // case it will be simply moved to become the last child of parentNode
            parentNode.appendChild(this._background);
            parentNode.appendChild(this._container);
        }
        this.show();
    };
    /**
     * Hides the screen (makes it invisible and not take any screen space)
     */
    HTMLScreen.prototype.hide = function () {
        if (this._container && this._background) {
            this._container.style.display = "none";
            this._background.style.display = "none";
        } else {
            application.showError("Attempting to hide screen '" + this._name + "' before adding it to the page!");
        }
    };
    /**
     * Tells whether the screen is superimposed on top of another one.
     * @returns {Boolean}
     */
    HTMLScreen.prototype.isSuperimposed = function () {
        return this._background && (this._background.style.display !== "none");
    };
    /**
     * Executes the necessary actions required when closing the page. This method
     * only nulls out the default components, additional functions need to be added
     * in the descendant classes.
     */
    HTMLScreen.prototype.removeFromPage = function () {
        var i;
        if (this._container && this._background) {
            for (i = 0; i < this._simpleComponents.length; i++) {
                this._simpleComponents[i].resetComponent();
            }
            for (i = 0; i < this._externalComponentBindings.length; i++) {
                this._externalComponentBindings[i].component.resetComponent();
            }
            this._background.remove();
            this._container.remove();
            this._background = null;
            this._container = null;
        } else {
            application.showError("Attempting to remove screen '" + this._name + "' before adding it to the page!");
        }
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
        for (i = 0; i < this._externalComponentBindings.length; i++) {
            if (this._externalComponentBindings[i].parentNodeID) {
                parentNode = this.getElement(this._externalComponentBindings[i].parentNodeID);
            }
            // otherwise just leave it undefined, nothing to pass to the method below
            this.addExternalComponent(this._externalComponentBindings[i].component, parentNode);
        }
        this._updateComponents();
    };
    /**
     * Returns appropriately prefixed version of the original, passed ID that would correspond
     * to the ID of an element on this screen.
     * @param {String} originalElementID
     * @returns {String}
     */
    HTMLScreen.prototype._getElementID = function (originalElementID) {
        return this._name + ELEMENT_ID_SEPARATOR + originalElementID;
    };
    /**
     * Returns the original ID of an element of this screen, that is, the ID without prefixes referring 
     * to this screen.
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
        if (this._container) {
            application.log("Screen '" + this._name + "' is getting updated.", 2);
            translatableElements = this._container.querySelectorAll("." + TRANSLATABLE_CLASS_NAME);
            for (i = 0; i < translatableElements.length; i++) {
                translatableElements[i].innerHTML = strings.get({
                    name: this._name + TRANSLATION_KEY_SEPARATOR + this._getOriginalElementID(translatableElements[i]),
                    defaultValue: translatableElements[i].innerHTML
                });
            }
            for (i = 0; i < this._externalComponentBindings.length; i++) {
                this._externalComponentBindings[i].component.updateComponents();
            }
        }
    };
    /**
     * Updates all components on this screen to be up-to-date with the application state.
     */
    HTMLScreen.prototype.updateScreen = function () {
        this._updateComponents();
    };
    /**
     * Sets up the component to be associated with an HTML element on this page having the 
     * passed original ID, which will serve as the name for the component.
     * @param {String} simpleComponentName
     * @returns {SimpleComponent}
     */
    HTMLScreen.prototype.registerSimpleComponent = function (simpleComponentName) {
        var component = new components.SimpleComponent(simpleComponentName, this._getElementID(simpleComponentName));
        this._simpleComponents.push(component);
        return component;
    };
    /**
     * A reference to the passed external component associated with the passed parent node ID will be stored, and
     * when the screen is added to the page, the external component will be added under the node with the passed
     * original ID. This also makes the screen wait for the component to load before adding it to the page.
     * The root element ID of the passed component will be prefixed with the name of the screen.
     * @param {ExternalComponent} externalComponent
     * @param {String} [parentNodeID]
     * @returns {ExternalComponent}
     */
    HTMLScreen.prototype.registerExternalComponent = function (externalComponent, parentNodeID) {
        // note that one more component needs to be loaded for the page to be ready
        this._externalComponentsToLoad++;
        // save the reference
        this._externalComponentBindings.push({
            component: externalComponent,
            parentNodeID: parentNodeID
        });
        // prefix the element ID with the name of the screen
        externalComponent.setRootElementID(this._getElementID(externalComponent.getName()));
        // set the callback to check if we are ready with the screen loading when this component is loaded
        externalComponent.executeWhenReady(function () {
            this._externalComponentsLoaded++;
            if (this._isLoaded()) {
                this.setToReady();
            }
        }.bind(this));
        return externalComponent;
    };
    /**
     * Appends the elements of an external component (a HTML document fragment
     * defined in an external xml file) to the DOM tree and returns the same 
     * component.
     * @param {ExternalComponent} externalComponent
     * @param {Node} [parentNode] The node in the document to which to append the
     * component (if omitted, it will be appended to the body)
     * @returns {ExternalComponent}
     */
    HTMLScreen.prototype.addExternalComponent = function (externalComponent, parentNode) {
        externalComponent.appendToPage(parentNode);
        return externalComponent;
    };
    /**
     * Provides visual information to the user about the current status of the application.
     * @param {String} newStatus The new status to display.
     */
    HTMLScreen.prototype.updateStatus = function (newStatus) {
        if (this._status) {
            this._status.setContent(newStatus);
        } else {
            alert(newStatus);
        }
    };
    /**
     * Returns the HTML element that is part of this screen and had the given original ID
     * @param {String} originalElementID
     * @returns {Element}
     */
    HTMLScreen.prototype.getElement = function (originalElementID) {
        return this._container.querySelector("#" + this._getElementID(originalElementID));
    };
    // #########################################################################
    /**
     * @class An enhanced canvas element (a wrapper around a regular HTML canvas), 
     * that can create and hold a reference to a managed WebGL context for the canvas.
     * @param {HTMLCanvasElement} canvas The canvas around which this object should be created.
     * @param {Boolean} antialiasing Whether antialiasing should be turned on for the GL context of this canvas
     * @param {String} filtering (enum managedGL.TextureFiltering) What texture filtering mode to use when rendering to this canvas
     */
    function ScreenCanvas(canvas, antialiasing, filtering) {
        /**
         * A reference to the wrapped HTML5 canvas.
         * @type HTMLCanvasElement
         */
        this._canvas = canvas;
        /**
         * Whether the size of this canvas can change when resizing the screen
         * @type Boolean
         */
        this._resizeable = canvas.classList.contains(RESIZEABLE_CLASS_NAME);
        /**
         * Whether antialiasing should be turned on for the GL context of this canvas
         * @type Boolean
         */
        this._antialiasing = antialiasing;
        /**
         * (enum managedGL.TextureFiltering) What texture filtering mode to use when rendering to this canvas
         * @type String
         */
        this._filtering = types.getEnumValue(managedGL.TextureFiltering, filtering, {name: "ScreenCanvas.filtering"});
        /**
         * A reference to the managed GL context associated with this canvas.
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
     * Tells if the canvas is resizeable = if it has a dynamic size that changes when the window is resized.
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
        if (!this._context) {
            this._context = new managedGL.ManagedGLContext(this._canvas.getAttribute("id"), this._canvas, this._antialiasing, this._filtering);
        }
        return this._context;
    };
    /**
     * If a managed context has already been created for this canvas, clears it so that it can be safely set up again with e.g. new 
     * framebuffers or vertexbuffers. Does not remove the added resources from the context.
     */
    ScreenCanvas.prototype.clearManagedContext = function () {
        if (this._context) {
            this._context.clear();
        }
    };
    /**
     * Sets a new antialiasing setting for the managed context to be created for this canvas, or if it was already created, notifies a user
     * that a restart is required.
     * @param {Boolean} value
     * @returns {Boolean} Whether the antialiasing value is now the same as the passed one.
     */
    ScreenCanvas.prototype.setAntialiasing = function (value) {
        if (value !== this._antialiasing) {
            if (this._context) {
                application.showError(strings.get(ANTIALIASING_CHANGE_ERROR_STRING));
                return false;
            }
            this._antialiasing = value;
        }
        return true;
    };
    /**
     * Sets a new filtering option for the textures rendered to the managed context of this canvas.
     * @param {String} value (enum ManagedGL.TextureFiltering)
     */
    ScreenCanvas.prototype.setFiltering = function (value) {
        if (value !== this._filtering) {
            this._filtering = value;
            if (this._context) {
                this._context.setFiltering(this._filtering);
            }
        }
    };
    // #########################################################################
    /**
     * @class Represents a game screen that has one or more canvases where WebGL scenes can be rendered.
     * @extends HTMLScreen
     * @param {String} name The name by which this screen can be identified.
     * @param {String} htmlFilename See HTMLScreen.
     * @param {HTMLScreen~Style} [style] See HTMLScreen.
     * @param {Boolean} antialiasing Whether antialiasing should be turned on for the GL contexts of the canvases of this screen
     * @param {String} filtering (enum managedGL.TextureFiltering) What texture filtering mode to use when rendering to a canvases of this screen
     * @param {Boolean} [useRequestAnimFrame=false] Whether to use the requestAnimationFrame API for the render loop
     * (as opposed to setInterval)
     */
    function HTMLScreenWithCanvases(name, htmlFilename, style, antialiasing, filtering, useRequestAnimFrame) {
        HTMLScreen.call(this, name, htmlFilename, style);
        /**
         * Whether antialiasing should be turned on for the GL contexts of the canvases of this screen
         * @type Boolean
         */
        this._antialiasing = antialiasing;
        /**
         * (enum managedGL.TextureFiltering) What texture filtering mode to use when rendering to a canvases of this screen
         * @type String
         */
        this._filtering = htmlFilename ? types.getEnumValue(managedGL.TextureFiltering, filtering, {name: "HTMLScreenWithCanvases.filtering"}) : null;
        /**
         * Stores the canvases of the screen by their names (IDs)
         * @type Object.<String, ScreenCanvas>
         */
        this._canvases = {};
        /**
         * @typedef {Object} HTMLScreenWithCanvases~ScreenCanvasBinding
         * @property {Scene} scene
         * @property {ScreenCanvas} canvas
         */
        /**
         * Stores all the active bindings that exist between the canvases of this screen and WebGL (BudaScene)
         * Scenes. When calling render or starting the render loop, all the scenes present in these bindings
         * will be automatically rendered on their corresponding canvases.
         * @type HTMLScreenWithCanvases~ScreenCanvasBinding[]
         */
        this._sceneCanvasBindings = [];
        /**
         * An ID for the render loop so that it can be cleared (when using setInterval)
         * @type Number
         */
        this._renderLoop = LOOP_CANCELED;
        /**
         * Stores the timestamps of the last renders so that the FPS can be calculated.
         * @type DOMHighResTimeStamp[]
         */
        this._renderTimes = null;
        /**
         * A reference to the function that is set to handle the resize event for this screen so
         * that it can be removed if the screen is no longer active.
         * @type Function
         */
        this._resizeEventListener = null;
        /**
         * Whether to use the requestAnimationFrame API for the render loop (as opposed to setInterval)
         * @type Boolean
         */
        this._useRequestAnimFrame = useRequestAnimFrame;
    }
    HTMLScreenWithCanvases.prototype = new HTMLScreen();
    HTMLScreenWithCanvases.prototype.constructor = HTMLScreenWithCanvases;
    /**
     * A handler for the resize event of the window so that e.g. the projection matrices used to render
     * the scene can be adjusted for the new aspect ratio.
     */
    HTMLScreenWithCanvases.prototype.handleResize = function () {
        this.resizeCanvases();
    };
    /**
     * Removes all stored binding between scenes and canvases. 
     * This removes all references to the related scenes existing in this object.
     */
    HTMLScreenWithCanvases.prototype.clearSceneCanvasBindings = function () {
        var i;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].canvas.clearManagedContext();
        }
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
     * @override
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
        // save a specific reference so we can remove it later
        this._resizeEventListener = this.handleResize.bind(this);
        window.addEventListener("resize", this._resizeEventListener);
    };
    /**
     * Returns the stored canvas component that corresponds to the HTML5 canvas element with the passed
     * original ID.
     * @param {String} name
     * @returns {ScreenCanvas}
     */
    HTMLScreenWithCanvases.prototype.getScreenCanvas = function (name) {
        return this._canvases[this._getElementID(name)];
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
        if (this._renderLoop !== LOOP_CANCELED) {
            canvas.getManagedContext().setup();
        }
    };
    /**
     * Sets a new antialiasing setting for the managed contexts to be created for the canvases of this screen, or if some were already 
     * created with a different antialiasing setting, notifies a user that a restart is required.
     * @param {Boolean} value
     */
    HTMLScreenWithCanvases.prototype.setAntialiasing = function (value) {
        var canvasName;
        if (value !== this._antialiasing) {
            this._antialiasing = value;
            for (canvasName in this._canvases) {
                if (this._canvases.hasOwnProperty(canvasName)) {
                    if (!this._canvases[canvasName].setAntialiasing(this._antialiasing)) {
                        return;
                    }
                }
            }
        }
    };
    /**
     * Sets a new filtering option for the textures rendered to the managed contexts of the canvases of this screen.
     * @param {String} value (enum ManagedGL.TextureFiltering)
     */
    HTMLScreenWithCanvases.prototype.setFiltering = function (value) {
        var canvasName;
        value = types.getEnumValue(managedGL.TextureFiltering, value, {name: "HTMLScreenWithCanvases.filtering", defaultValue: this._filtering});
        if (value !== this._filtering) {
            this._filtering = value;
            for (canvasName in this._canvases) {
                if (this._canvases.hasOwnProperty(canvasName)) {
                    this._canvases[canvasName].setFiltering(this._filtering);
                }
            }
        }
    };
    /**
     * The core render function that needs to be overridden adding any additional rendering next to
     * rendering the bound scenes to their canvases.
     * @param {Number} dt The time passed since the last render in milliseconds.
     */
    HTMLScreenWithCanvases.prototype._render = function (dt) {
        var i;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].scene.cleanUp();
            this._sceneCanvasBindings[i].scene.render(this._sceneCanvasBindings[i].canvas.getManagedContext(), dt);
        }
    };
    /**
     * Calls the core render method and manages the timestamps for FPS calculation as a simple 
     * standalone method that can be used with setInterval or on its own for a single render.
     */
    HTMLScreenWithCanvases.prototype.render = function () {
        var d, dt;
        d = performance.now();
        dt = (this._renderTimes && (this._renderTimes.length > 0)) ? (d - this._renderTimes[this._renderTimes.length - 1]) : 0;
        this._render(dt);
        if (this._renderLoop !== LOOP_CANCELED) {
            this._renderTimes.push(d);
            while ((this._renderTimes.length > 1) && ((d - this._renderTimes[0]) > 1000)) {
                this._renderTimes.shift();
            }
        }
    };
    /**
     * Calls the core render method and manages the timestamps for FPS calculation, and if needed, maintains
     * the render loop using the RequestAnimationFrame API.
     * @param {DOMHighResTimeStamp} timestamp
     */
    HTMLScreenWithCanvases.prototype._renderRequestAnimFrame = function (timestamp) {
        var dt;
        if (this._renderLoop !== LOOP_CANCELED) {
            dt = (this._renderTimes && (this._renderTimes.length > 0)) ? (timestamp - this._renderTimes[this._renderTimes.length - 1]) : 0;
            this._render(dt);
            this._renderTimes.push(timestamp);
            while ((this._renderTimes.length > 1) && ((timestamp - this._renderTimes[0]) > 1000)) {
                this._renderTimes.shift();
            }
            window.requestAnimationFrame(this._renderRequestAnimFrame.bind(this));
        }
    };
    /**
     * Starts the render loop, by beginning to execute the render function every interval milliseconds or
     * using the requestAnimationFrame API.
     * @param {Number} interval This will only be considered if setInterval, and not the RequestAnimationFrame
     * API is used
     */
    HTMLScreenWithCanvases.prototype.startRenderLoop = function (interval) {
        var i;
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].canvas.getManagedContext().setup();
        }
        this._renderTimes = [performance.now()];
        if (this._useRequestAnimFrame) {
            this._renderLoop = LOOP_REQUESTANIMFRAME;
            window.requestAnimationFrame(this._renderRequestAnimFrame.bind(this));
        } else {
            this._renderLoop = setInterval(function () {
                this.render();
            }.bind(this), interval);
        }
    };
    /**
     * Stops the render loop.
     */
    HTMLScreenWithCanvases.prototype.stopRenderLoop = function () {
        if (!this._useRequestAnimFrame) {
            clearInterval(this._renderLoop);
        }
        this._renderLoop = LOOP_CANCELED;
        this._renderTimes = null;
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
        var
                canvasElement = this._canvases[name].getCanvasElement(),
                width = canvasElement.clientWidth,
                height = canvasElement.clientHeight;
        if (canvasElement.width !== width ||
                canvasElement.height !== height) {
            // Change the size of the canvas to match the size it's being displayed
            canvasElement.width = width;
            canvasElement.height = height;
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
     * @class A game screen with a menu component and related convenience constructor.
     * @extends HTMLScreen
     * @param {String} name See HTMLScreen.
     * @param {String} htmlFilename See HTMLScreen.
     * @param {HTMLScreen~Style} [style] See HTMLScreen.
     * @param {String} menuHTMLFilename The filename of the HTML source file of the menu component.
     * @param {MenuComponent~Style} [menuStyle] The style information for the menu component.
     * @param {MenuComponent~MenuOption[]} menuOptions The menuOptions for creating the menu component.
     * @param {String} [menuContainerID] The ID of the HTML element inside of which
     * the menu should be added (if omitted, it will be appended to body)
     */
    function MenuScreen(name, htmlFilename, style, menuHTMLFilename, menuStyle, menuOptions, menuContainerID) {
        HTMLScreen.call(this, name, htmlFilename, style);
        /**
         * The menuOptions for creating the menu component.
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
        this._menuComponent = this.registerExternalComponent(
                new components.MenuComponent(
                        MENU_COMPONENT_NAME,
                        menuHTMLFilename,
                        menuStyle,
                        this._menuOptions),
                this._menuContainerID);
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