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
 * @param utils Used for converting RGBA color to CSS color strings and for format strings
 * @param types Used for handling enum values
 * @param application Used for logging and file loading functionality
 * @param asyncResource Screens are subclassed from AsyncResource as they are loaded from external XML files
 * @param components Screens contain components
 * @param managedGL Screens having canvases provide the managed GL contexts for them
 * @param resources Used to clear media resource bindings to contexts of removed screens
 * @param strings Used to offer translation support
 */
define([
    "utils/utils",
    "utils/types",
    "modules/application",
    "modules/async-resource",
    "modules/components",
    "modules/managed-gl",
    "modules/media-resources",
    "modules/strings"
], function (utils, types, application, asyncResource, components, managedGL, resources, strings) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            SCREEN_FOLDER = "screen",
            CSS_FOLDER = "css",
            // keys for the eventHandlers parameters passed to screen constructors
            SHOW_EVENT_NAME = components.SHOW_EVENT_NAME,
            HIDE_EVENT_NAME = components.HIDE_EVENT_NAME,
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
     * @class Holds the logical model of a screen of the game. The different screens should be defined as descendants of this class.
     * @extends AsyncResource
     * @param {String} name The name by which this screen can be identified. Needs to be unique within the same application (ScreenManager). 
     * The ID of HTML elements belonging to this screen will be prefixed by this name.
     * @param {String} htmlFilename The name of the HTML file where the structure of this screen is defined.
     * @param {HTMLScreen~Style} [style] The object storing the styling information for this screen.
     * @param {Object.<String, Function>} [eventHandlers] Event handler functions to be executed when something happens to this page, by the
     * names of the events as keys
     * @param {Object.<String, Function>} [keyCommands] Event handler functions to be executed while this screen is active, by the names of 
     * the keys (as in utils.getKeyCodeOf())
     * @param {Object.<String, Object.<String, Function>>} [elementEventHandlers] Objects storing the event handlers for HTML elements on
     * this page: the keys are the query selectors to choose the elements, the values are event handler objects just like the eventHandlers
     * parameter.
     */
    function HTMLScreen(name, htmlFilename, style, eventHandlers, keyCommands, elementEventHandlers) {
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
        /**
         * Whether the screen is currently visible (its container and background are added to the DOM and their display style is not set to "none")
         * @type Boolean
         */
        this._visible = false;
        /**
         * Optional callback to be executed whenever this screen is shown. (show() is called)
         * @type Function
         */
        this._onShow = eventHandlers ? eventHandlers[SHOW_EVENT_NAME] : null;
        /**
         * Optional callback to be executed whenever this screen is hidden. (hide() is called)
         * @type Function
         */
        this._onHide = eventHandlers ? eventHandlers[HIDE_EVENT_NAME] : null;
        /**
         * A reference to the event listener function listening to the keydown event to handle the key commands
         * valid on this screen.
         * @type Function
         */
        this._keyDownHandler = keyCommands ? this._getKeyDownHandler(keyCommands) : null;
        /**
         * The event handlers for HTML elements on this page: the keys are the query selectors to choose the elements, the values are event 
         * handler objects storing the handler functions by the names of the events.
         * @type Object.<String, Object.<String, Function>>
         */
        this._elementEventHandlers = elementEventHandlers || null;
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
     * Generates and returns an event listener function that can be added to the DOM to listen for "keydown"
     * events and perform the actions defined in the keyCommands parameter that is in the same format as for
     * the constructor.
     * @param {Object.<String, Function>} keyCommands
     * @returns {Function}
     */
    HTMLScreen.prototype._getKeyDownHandler = function (keyCommands) {
        var keyCommandsByCode = {}, keys, i;
        keys = Object.keys(keyCommands);
        for (i = 0; i < keys.length; i++) {
            keyCommandsByCode[utils.getKeyCodeOf(keys[i])] = keyCommands[keys[i]];
        }
        return function (event) {
            if (keyCommandsByCode[event.keyCode]) {
                keyCommandsByCode[event.keyCode].call(this);
            }
        }.bind(this);
    };
    /**
     * Adds the appropriate event listeners for this screen to the DOM.
     */
    HTMLScreen.prototype._addEventListeners = function () {
        if (this._keyDownHandler) {
            document.addEventListener("keydown", this._keyDownHandler);
        }
    };
    /**
     * Removes the previously added (if any) event listeners for this screen from the DOM.
     */
    HTMLScreen.prototype._removeEventListeners = function () {
        if (this._keyDownHandler) {
            document.removeEventListener("keydown", this._keyDownHandler);
        }
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
     * Specifies whether this screen is currently active. (e.g. should listen to input)
     * @param {Boolean} active
     */
    HTMLScreen.prototype.setActive = function (active) {
        if (active) {
            this._addEventListeners();
        } else {
            this._removeEventListeners();
        }
    };
    /**
     * Replaces the current HTML page's body with the sctructure of the screen.
     * @param {Function} callback
     */
    HTMLScreen.prototype.replacePageWithScreen = function (callback) {
        document.body.innerHTML = "";
        this.addScreenToPage(function () {
            if (callback) {
                callback();
            }
            this.setActive(true);
        });
    };
    /**
     * Adds the event listeners defined in this class (in the _elementEventHandlers property) to the appropriate HTML elements on this 
     * screen
     * @param {Element} [parent] If given, only those elements will be considered, which are below this element in the DOM
     */
    HTMLScreen.prototype._addElementEventListeners = function (parent) {
        var elements, i, j, k, querySelectors, events;
        if (this._elementEventHandlers) {
            parent = parent || this._container;
            querySelectors = Object.keys(this._elementEventHandlers);
            for (i = 0; i < querySelectors.length; i++) {
                elements = parent.querySelectorAll(querySelectors[i]);
                events = Object.keys(this._elementEventHandlers[querySelectors[i]]);
                for (j = 0; j < elements.length; j++) {
                    for (k = 0; k < events.length; k++) {
                        elements[j].addEventListener(events[k], this._elementEventHandlers[querySelectors[i]][events[k]]);
                    }
                }
            }
        }
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
            var elements, i;
            this._background = document.createElement("div");
            this._background.setAttribute("id", this._getElementID(SCREEN_BACKGROUND_ID));
            this._background.className = this._style.backgroundClassName || DEFAULT_SCREEN_BACKGROUND_CLASS_NAME;
            this._background.style.display = "none";
            this._container = document.createElement("div");
            this._container.setAttribute("id", this._getElementID(SCREEN_CONTAINER_ID));
            this._container.className = this._style.containerClassName || DEFAULT_SCREEN_CONTAINER_CLASS_NAME;
            this._container.style.display = "none";
            this._container.innerHTML = this._model.body.innerHTML;
            elements = this._container.querySelectorAll("[id]");
            for (i = 0; i < elements.length; i++) {
                elements[i].setAttribute("id", this._getElementID(elements[i].getAttribute("id")));
            }
            parentNode.appendChild(this._background);
            parentNode.appendChild(this._container);
            this._visible = false;
            this._initializeComponents();
            this._addElementEventListeners();
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
     * @returns {Boolean} Whether the screen was made visible (false if it was already visible, and this method didn't do anything
     */
    HTMLScreen.prototype.show = function () {
        if (!this._visible) {
            if (this._container) {
                this._container.style.display = "block";
                this._visible = true;
                if (this._onShow) {
                    this._onShow();
                }
                return true;
            }
            application.showError("Attempting to show screen '" + this._name + "' before adding it to the page!");
        }
        return false;
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
                this._background.style.backgroundColor = utils.getCSSColor(backgroundColor);
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
     * @returns {Boolean} Whether the screen was hidden (false if it was already hidden, and this method didn't do anything
     */
    HTMLScreen.prototype.hide = function () {
        if (this._visible) {
            if (this._container && this._background) {
                this._container.style.display = "none";
                this._background.style.display = "none";
                this._visible = false;
                this.setActive(false);
                if (this._onHide) {
                    this._onHide();
                }
                return true;
            }
            application.showError("Attempting to hide screen '" + this._name + "' before adding it to the page!");
        }
        return false;
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
            this.setActive(false);
            this._background.remove();
            this._container.remove();
            this._background = null;
            this._container = null;
            this._visible = false;
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
     * @class
     * A text with associated state (layout and style) that can be rendered on 2D canvases.
     * @param {Number[2]} position The starting position of the text in the clip space of the canvas.
     * @param {String} text The starting value of the text to display.
     * @param {String} font The name of the font to use (as in CSS font-family)
     * @param {Number} size The relative size of the font to use (relative to the width or height (depending on the scaling mode) of the canvas in pixels)
     * @param {String} scaleMode enum ScaleMode The scaling mode to use when determining the font size for rendering
     * @param {Number[4]} color The RGBA color to use when rendering
     * @param {String} [align="left"] The horizontal alignment mode for the text
     */
    function CanvasText(position, text, font, size, scaleMode, color, align) {
        /**
         * The X coordinate of the relative position of the text in the clip space of the canvas it is rendered to.
         * @type Number
         */
        this._x = position[0];
        /**
         * The Y coordinate of the relative position of the text in the clip space of the canvas it is rendered to.
         * @type Number
         */
        this._y = position[1];
        /**
         * The current text to render.
         * @type String
         */
        this._text = text;
        /**
         * The name of the font to use (as in CSS font-family)
         * @type String
         */
        this._font = font;
        /**
         * The relative size of the font to use (relative to the width or height (depending on the scaling mode) of the canvas in pixels)
         * @type Number
         */
        this._size = size;
        /**
         * (enum ScaleMode) The scaling mode to use when determining the font size for rendering
         * @type String
         */
        this._scaleMode = types.getEnumValue(utils.ScaleMode, scaleMode);
        if (this._scaleMode === utils.ScaleMode.ASPECT) {
            application.showError("Cannot set the scaling mode to aspect for fonts!");
        }
        /**
         * The RGBA color to use when rendering
         * @type Number[4]
         */
        this._color = color;
        /**
         * The horizontal alignment mode for the text
         * @type String
         */
        this._align = align || "left";
        /**
         * Whether the text is currently visible (should be rendered when calling render())
         * @type Boolean
         */
        this._visible = true;
    }
    /**
     * Returns a string defining the font and its settings to be used for rendering to a canvas with the passed viewport size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {String}
     */
    CanvasText.prototype._getCSSFont = function (viewportWidth, viewportHeight) {
        var result;
        if (utils.scalesWithWidth(this._scaleMode, viewportWidth, viewportHeight)) {
            result = this._size * viewportWidth + "px";
        } else {
            result = this._size * viewportHeight + "px";
        }
        result = result + " " + this._font;
        return result;
    };
    /**
     * Renders the text using the passed 2D rendering context (of a canvas) according to its current settings.
     * @param {CanvasRenderingContext2D} context
     */
    CanvasText.prototype.render = function (context) {
        var width, height;
        if (this._visible) {
            context.fillStyle = utils.getCSSColor(this._color);
            width = context.canvas.width;
            height = context.canvas.height;
            context.font = this._getCSSFont(width, height);
            context.textAlign = this._align;
            context.fillText(this._text, (this._x + 1) / 2 * width, (1 - this._y) / 2 * height);
        }
    };
    /**
     * Sets a new position for the text (in the clip space of the canvas it is rendered to)
     * @param {Number[2]} position
     */
    CanvasText.prototype.setPosition = function (position) {
        this._x = position[0];
        this._y = position[1];
    };
    /**
     * Sets a new value for the actual text that is displayed when rendering this object.
     * @param {String} text
     * @param {Object} [replacements] If given, the provided text is taken as a format strings, with its references replaced by the values
     * provided in this object. (e.g. "hello, {w}", {w: "world"} -> "hello, world"
     */
    CanvasText.prototype.setText = function (text, replacements) {
        this._text = replacements ? utils.formatString(text, replacements) : text;
    };
    /**
     * Sets a new RGBA color to use when rendering this text
     * @param {Number[4]} color
     */
    CanvasText.prototype.setColor = function (color) {
        this._color = color;
    };
    /**
     * After calling this, the text is rendered whenever calling render() (until hidden)
     */
    CanvasText.prototype.show = function () {
        this._visible = true;
    };
    /**
     * After calling this, the text is not rendered anymore when calling render() (until shown)
     */
    CanvasText.prototype.hide = function () {
        this._visible = false;
    };
    // #########################################################################
    /**
     * @typedef {Object} LayoutDescriptor
     * @property {Number} [left]
     * @property {Number} [centerX]
     * @property {Number} [right]
     * @property {Number} [top]
     * @property {Number} [centerY]
     * @property {Number} [bottom]
     * @property {Number} [width]
     * @property {Number} [height]
     * @property {String} scaleMode enum ScaleMode
     * @property {String} [xScaleMode] enum ScaleMode
     * @property {String} [yScaleMode] enum ScaleMode
     */
    /**
     * @class
     * Stores a set of layout settings given using clip-space coordinates and can calculate and provide coordinates of the rectangle defined
     * by these settings in different coordinate systems / scaled to a specific viewport.
     * @param {LayoutDescriptor} layoutDescriptor The descriptor object to load the settings from
     */
    function ClipSpaceLayout(layoutDescriptor) {
        /**
         * If given, the left side of the rectangle should be located at this X coordinate in clip-space.
         * @type Number
         */
        this._left = layoutDescriptor.left;
        /**
         * If given, the horizontal center of the rectangle should be located at this X coordinate in clip-space.
         * @type Number
         */
        this._centerX = layoutDescriptor.centerX;
        /**
         * If given, the right side of the rectangle should be located at this X coordinate in clip-space.
         * @type Number
         */
        this._right = layoutDescriptor.right;
        /**
         * If given, the top side of the rectangle should be located at this Y coordinate in clip-space.
         * @type Number
         */
        this._top = layoutDescriptor.top;
        /**
         * If given, the vertical center of the rectangle should be located at this Y coordinate in clip-space.
         * @type Number
         */
        this._centerY = layoutDescriptor.centerY;
        /**
         * If given, the bottom side of the rectangle should be located at this Y coordinate in clip-space.
         * @type Number
         */
        this._bottom = layoutDescriptor.bottom;
        /**
         * If given, the width of the rectangle should equal this distance in clip-space.
         * @type Number
         */
        this._width = layoutDescriptor.width;
        /**
         * If given, the height of the rectangle should equal this distance in clip-space.
         * @type Number
         */
        this._height = layoutDescriptor.height;
        /**
         * (enum ScaleMode) Determines how the actual size of the rectangle is calculated when scaled to a specific viewport.
         * @type String
         */
        this._scaleMode = types.getEnumValue(utils.ScaleMode, layoutDescriptor.scaleMode);
        /**
         * (enum ScaleMode) Determines how the X coordinate of the position of the rectangle is calculated when scaling to a specific 
         * viewport. If a left coordinate is stored in this layout, the appropriate scaling is applied from the left side of the viewport, 
         * if a center X coordinate is stored, the scaling is applied from the horizontal center of the viewport and if a right coordinate
         * is stored, from the right side of the viewport.
         * @type String
         */
        this._xScaleMode = types.getEnumValue(utils.ScaleMode, layoutDescriptor.xScaleMode || utils.ScaleMode.ASPECT);
        /**
         * (enum ScaleMode) Determines how the Y coordinate of the position of the rectangle is calculated when scaling to a specific 
         * viewport. If a top coordinate is stored in this layout, the appropriate scaling is applied from the top of the viewport, 
         * if a center Y coordinate is stored, the scaling is applied from the vertical center of the viewport and if a bottom coordinate
         * is stored, from the bottom of the viewport.
         * @type String
         */
        this._yScaleMode = types.getEnumValue(utils.ScaleMode, layoutDescriptor.yScaleMode || utils.ScaleMode.ASPECT);
        if (!this._isValid()) {
            application.showError("Invalid layout specified!");
        }
    }
    /**
     * Returns whether this object contains settings for which all coordinates can be calculated without ambiguity.
     * @returns {Boolean}
     */
    ClipSpaceLayout.prototype._isValid = function () {
        var numAnchors;
        if (this._width !== undefined) {
            numAnchors = 0;
            if (this._left !== undefined) {
                numAnchors++;
            }
            if (this._centerX !== undefined) {
                numAnchors++;
            }
            if (this._right !== undefined) {
                numAnchors++;
            }
            if (numAnchors !== 1) {
                return false;
            }
        } else {
            if ((this._left === undefined) || (this._centerX !== undefined) || (this._right === undefined)) {
                return false;
            }
            if ((this._scaleMode !== utils.ScaleMode.ASPECT) || (this._xScaleMode !== utils.ScaleMode.ASPECT)) {
                return false;
            }
        }
        if (this._height !== undefined) {
            numAnchors = 0;
            if (this._top !== undefined) {
                numAnchors++;
            }
            if (this._centerY !== undefined) {
                numAnchors++;
            }
            if (this._bottom !== undefined) {
                numAnchors++;
            }
            if (numAnchors !== 1) {
                return false;
            }
        } else {
            if ((this._top === undefined) || (this._centerY !== undefined) || (this._bottom === undefined)) {
                return false;
            }
            if ((this._scaleMode !== utils.ScaleMode.ASPECT) || (this._yScaleMode !== utils.ScaleMode.ASPECT)) {
                return false;
            }
        }
        return true;
    };
    /**
     * Returns the X coordinate of the horizontal center of the rectangle specified by this layout in clip-space.
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getClipSpaceCenterX = function () {
        if (this._centerX !== undefined) {
            return this._centerX;
        }
        if (this._width !== undefined) {
            if (this._left !== undefined) {
                return this._left + this._width / 2;
            }
            return this._right - this._width / 2;
        }
        return (this._left + this._right) / 2;
    };
    /**
     * Returns the Y coordinate of the vertical center of the rectangle specified by this layout in clip-space.
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getClipSpaceCenterY = function () {
        if (this._centerY !== undefined) {
            return this._centerY;
        }
        if (this._height !== undefined) {
            if (this._bottom !== undefined) {
                return this._bottom + this._height / 2;
            }
            return this._top - this._height / 2;
        }
        return (this._bottom + this._top) / 2;
    };
    /**
     * Returns the position of the center of the rectangle specified by this layout in clip-space.
     * @returns {Number[2]}
     */
    ClipSpaceLayout.prototype.getClipSpacePosition = function () {
        return [
            this.getClipSpaceCenterX(),
            this.getClipSpaceCenterY()];
    };
    /**
     * Returns the width of the rectangle specified by this layout in clip-space.
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getClipSpaceWidth = function () {
        if (this._width !== undefined) {
            return this._width;
        }
        return this._right - this._left;
    };
    /**
     * Returns the height of the rectangle specified by this layout in clip-space.
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getClipSpaceHeight = function () {
        if (this._height !== undefined) {
            return this._height;
        }
        return this._top - this._bottom;
    };
    /**
     * Returns the width and height of the rectangle specified by this layout in clip-space.
     * @returns {Number[2]}
     */
    ClipSpaceLayout.prototype.getClipSpaceSize = function () {
        return [
            this.getClipSpaceWidth(),
            this.getClipSpaceHeight()];
    };
    /**
     * Returns the X coordinate of the left edge of the rectangle specified by this layout in clip-space.
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getClipSpaceLeft = function () {
        if (this._left !== undefined) {
            return this._left;
        }
        return this.getClipSpaceCenterX() - this.getClipSpaceWidth() / 2;
    };
    /**
     * Returns the X coordinate of the right edge of the rectangle specified by this layout in clip-space.
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getClipSpaceRight = function () {
        if (this._right !== undefined) {
            return this._right;
        }
        return this.getClipSpaceCenterX() + this.getClipSpaceWidth() / 2;
    };
    /**
     * Returns the Y coordinate of the bottom edge of the rectangle specified by this layout in clip-space.
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getClipSpaceBottom = function () {
        if (this._bottom !== undefined) {
            return this._bottom;
        }
        return this.getClipSpaceCenterY() - this.getClipSpaceHeight() / 2;
    };
    /**
     * Returns the Y coordinate of the top edge of the rectangle specified by this layout in clip-space.
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getClipSpaceTop = function () {
        if (this._top !== undefined) {
            return this._top;
        }
        return this.getClipSpaceCenterY() + this.getClipSpaceHeight() / 2;
    };
    /**
     * Returns the width of the rectangle specified by this layout in pixels when scaled to a viewport of the given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getWidth = function (viewportWidth, viewportHeight) {
        return this.getClipSpaceWidth() / 2 * (
                utils.xScalesWithWidth(this._scaleMode, viewportWidth, viewportHeight) ?
                viewportWidth :
                viewportHeight);
    };
    /**
     * Returns the height of the rectangle specified by this layout in pixels when scaled to a viewport of the given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getHeight = function (viewportWidth, viewportHeight) {
        return this.getClipSpaceHeight() / 2 * (
                utils.yScalesWithHeight(this._scaleMode, viewportWidth, viewportHeight) ?
                viewportHeight :
                viewportWidth);
    };
    /**
     * Returns the width and height of the rectangle specified by this layout in pixels when scaled to a viewport of the given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getSize = function (viewportWidth, viewportHeight) {
        return [
            this.getWidth(viewportWidth, viewportHeight),
            this.getHeight(viewportWidth, viewportHeight)];
    };
    /**
     * Returns the X coordinate of the horizontal center of the rectangle specified by this layout in pixels when scaled to a viewport of 
     * the given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getCenterX = function (viewportWidth, viewportHeight) {
        var scale;
        if (utils.xScalesWithWidth(this._xScaleMode, viewportWidth, viewportHeight)) {
            scale = viewportWidth;
        } else {
            scale = viewportHeight;
        }
        if (this._left !== undefined) {
            return (this.getClipSpaceLeft() + 1) / 2 * scale + this.getWidth(viewportWidth, viewportHeight) / 2;
        }
        if (this._centerX !== undefined) {
            return viewportWidth / 2 + this.getClipSpaceCenterX() / 2 * scale;
        }
        return viewportWidth - (1 - this.getClipSpaceRight()) / 2 * scale - this.getWidth(viewportWidth, viewportHeight) / 2;
    };
    /**
     * Returns the Y coordinate of the vertical center of the rectangle specified by this layout in pixels when scaled to a viewport of 
     * the given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getCenterY = function (viewportWidth, viewportHeight) {
        var scale;
        if (utils.yScalesWithHeight(this._yScaleMode, viewportWidth, viewportHeight)) {
            scale = viewportHeight;
        } else {
            scale = viewportWidth;
        }
        if (this._top !== undefined) {
            return (1 - this.getClipSpaceTop()) / 2 * scale + this.getHeight(viewportWidth, viewportHeight) / 2;
        }
        if (this._centerY !== undefined) {
            return viewportHeight / 2 - this.getClipSpaceCenterY() / 2 * scale;
        }
        return viewportHeight - (this.getClipSpaceBottom() + 1) / 2 * scale - this.getHeight(viewportWidth, viewportHeight) / 2;
    };
    /**
     * Returns the position of the center of the rectangle specified by this layout in pixels when scaled to a viewport of the given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number[2]}
     */
    ClipSpaceLayout.prototype.getPosition = function (viewportWidth, viewportHeight) {
        return [
            this.getCenterX(viewportWidth, viewportHeight),
            this.getCenterY(viewportWidth, viewportHeight)];
    };
    /**
     * Returns the X coordinate of the left edge of the rectangle specified by this layout in pixels when scaled to a viewport of the given 
     * size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getLeft = function (viewportWidth, viewportHeight) {
        var scale;
        if (utils.xScalesWithWidth(this._xScaleMode, viewportWidth, viewportHeight)) {
            scale = viewportWidth;
        } else {
            scale = viewportHeight;
        }
        if (this._left !== undefined) {
            return (this.getClipSpaceLeft() + 1) / 2 * scale;
        }
        if (this._centerX !== undefined) {
            return viewportWidth / 2 + this.getClipSpaceCenterX() / 2 * scale - this.getWidth(viewportWidth, viewportHeight) / 2;
        }
        return viewportWidth - (1 - this.getClipSpaceRight()) / 2 * scale - this.getWidth(viewportWidth, viewportHeight);
    };
    /**
     * Returns the Y coordinate of the top edge of the rectangle specified by this layout in pixels when scaled to a viewport of the given 
     * size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getTop = function (viewportWidth, viewportHeight) {
        var scale;
        if (utils.yScalesWithHeight(this._yScaleMode, viewportWidth, viewportHeight)) {
            scale = viewportHeight;
        } else {
            scale = viewportWidth;
        }
        if (this._top !== undefined) {
            return (1 - this.getClipSpaceTop()) / 2 * scale;
        }
        if (this._centerY !== undefined) {
            return viewportHeight / 2 - this.getClipSpaceCenterY() / 2 * scale - this.getHeight(viewportWidth, viewportHeight) / 2;
        }
        return viewportHeight - (this.getClipSpaceBottom() + 1) / 2 * scale - this.getHeight(viewportWidth, viewportHeight);
    };
    /**
     * Returns the Y coordinate of the bottom edge of the rectangle specified by this layout in pixels when scaled to a viewport of the 
     * given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getBottom = function (viewportWidth, viewportHeight) {
        var scale;
        if (utils.yScalesWithHeight(this._yScaleMode, viewportWidth, viewportHeight)) {
            scale = viewportHeight;
        } else {
            scale = viewportWidth;
        }
        if (this._top !== undefined) {
            return (1 - this.getClipSpaceTop()) / 2 * scale + this.getHeight(viewportWidth, viewportHeight);
        }
        if (this._centerY !== undefined) {
            return viewportHeight / 2 - this.getClipSpaceCenterY() / 2 * scale + this.getHeight(viewportWidth, viewportHeight) / 2;
        }
        return viewportHeight - (this.getClipSpaceBottom() + 1) / 2 * scale;
    };
    /**
     * Returns the X coordinate of the left edge of the rectangle specified by this layout in positive-relative space ([0;0]: bottom-left -
     * [1;1]: top right) when scaled to a viewport of the given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getPositiveLeft = function (viewportWidth, viewportHeight) {
        return this.getLeft(viewportWidth, viewportHeight) / viewportWidth;
    };
    /**
     * Returns the Y coordinate of the bottom edge of the rectangle specified by this layout in positive-relative space ([0;0]: bottom-left -
     * [1;1]: top right) when scaled to a viewport of the given size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getPositiveBottom = function (viewportWidth, viewportHeight) {
        return 1 - this.getBottom(viewportWidth, viewportHeight) / viewportHeight;
    };
    /**
     * Returns the width of the rectangle specified by this layout in positive-relative space (0-1) when scaled to a viewport of the given 
     * size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getPositiveWidth = function (viewportWidth, viewportHeight) {
        return this.getWidth(viewportWidth, viewportHeight) / viewportWidth;
    };
    /**
     * Returns the height of the rectangle specified by this layout in positive-relative space (0-1) when scaled to a viewport of the given 
     * size.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @returns {Number}
     */
    ClipSpaceLayout.prototype.getPositiveHeight = function (viewportWidth, viewportHeight) {
        return this.getHeight(viewportWidth, viewportHeight) / viewportHeight;
    };
    /**
     * (enum ScaleMode) Returns the scaling mode set for the size of the rectangle specified by this layout.
     * @returns {String}
     */
    ClipSpaceLayout.prototype.getScaleMode = function () {
        return this._scaleMode;
    };
    // #########################################################################
    /**
     * @class
     * Represents a rectangular area to which texts can be added and rendered to, with a layout specified in the clip-space of a containing 
     * larger viewport. Implemented using a 2D canvas.
     * @param {LayoutDescriptor} layoutDescriptor The object describing the layout settings for the area
     */
    function TextLayer(layoutDescriptor) {
        /**
         * The canvas used to render this text layer.
         * @type HTMLCanvasElement
         */
        this._canvas = document.createElement("canvas");
        /**
         * The object storing the layout settings for this text layer.
         * @type ClipSpaceLayout
         */
        this._clipSpaceLayout = new ClipSpaceLayout(layoutDescriptor);
        /**
         * The 2D context used to render the texts on this layer.
         * @type CanvasRenderingContext2D
         */
        this._context = this._canvas.getContext("2d");
        this._context.textBaseline = "top";
        /**
         * The list of stored texts that are rendered when this layer is rendered.
         * @type CanvasText[]
         */
        this._texts = [];
        /**
         * Whether the texts on this layer should be rendered when the layer is rendered.
         * @type Boolean
         */
        this._visible = true;
        /**
         * Whether the area of this text layer is currently cleared to transparent color.
         * @type Boolean
         */
        this._cleared = true;
    }
    /**
     * Clears the whole area of this text layer of all the previously rendered texts.
     * @param {String} [borderStyle] If given, a border with this style will be drawn at the edges of the area of this text layer.
     */
    TextLayer.prototype.clearContext = function (borderStyle) {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
        if (borderStyle) {
            this._context.strokeStyle = borderStyle;
            this._context.strokeRect(0, 0, this._canvas.width, this._canvas.height);
        }
    };
    /**
     * Adds a new text object to the list of texts that are rendered on this layer.
     * @param {CanvasText} value
     */
    TextLayer.prototype.addText = function (value) {
        this._texts.push(value);
    };
    /**
     * If currently visible, rendered all (visible) texts to this layer.
     */
    TextLayer.prototype.render = function () {
        var i;
        if (this._visible) {
            this.clearContext();
            for (i = 0; i < this._texts.length; i++) {
                this._texts[i].render(this._context);
            }
            this._cleared = false;
        }
    };
    /**
     * Repositions and resizes the text layer area accordingly if the size of the containing viewport has changed as given.
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     */
    TextLayer.prototype.handleResize = function (viewportWidth, viewportHeight) {
        this._canvas.style.top = this._clipSpaceLayout.getTop(viewportWidth, viewportHeight) + "px";
        this._canvas.style.left = this._clipSpaceLayout.getLeft(viewportWidth, viewportHeight) + "px";
        this._canvas.width = this._clipSpaceLayout.getWidth(viewportWidth, viewportHeight);
        this._canvas.height = this._clipSpaceLayout.getHeight(viewportWidth, viewportHeight);
    };
    /**
     * Sets a new containing canvas the position and size of which will determine the position and size of this text layer.
     * @param {HTMLCanvasElement} container
     */
    TextLayer.prototype.setContainer = function (container) {
        this.handleResize(container.width, container.height);
        container.parentNode.appendChild(this._canvas);
        this._canvas.style.position = "absolute";
        this._canvas.zIndex = container.zIndex + 1;
    };
    /**
     * After calling this, the (visible) texts on this layer are rendered whenever calling render()
     */
    TextLayer.prototype.show = function () {
        this._visible = true;
    };
    /**
     * Clears the text layer and after calling this, no texts on this layer are rendered when calling render()
     */
    TextLayer.prototype.hide = function () {
        if (!this._cleared) {
            this.clearContext();
            this._cleared = true;
        }
        this._visible = false;
    };
    /**
     * Returns the layout object specifying the positioning and sizing rules for this text layer.
     * @returns {ClipSpaceLayout}
     */
    TextLayer.prototype.getLayout = function () {
        return this._clipSpaceLayout;
    };
    // #########################################################################
    /**
     * @class An enhanced canvas element (a wrapper around a regular HTML canvas), 
     * that can create and hold a reference to a managed WebGL context for the canvas.
     * @param {HTMLCanvasElement} canvas The canvas around which this object should be created.
     * @param {Boolean} antialiasing Whether antialiasing should be turned on for the GL context of this canvas
     * @param {Boolean} alpha Whether alpha channel support (blending with the HTML element behind the canvas) 
     * should be turned on for this canvas.
     * @param {String} filtering (enum managedGL.TextureFiltering) What texture filtering mode to use when rendering to this canvas
     */
    function ScreenCanvas(canvas, antialiasing, alpha, filtering) {
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
         * Whether alpha channel support (blending with the HTML element behind the canvas) 
         * is turned on for (the GL context of) this canvas.
         * @type Boolean
         */
        this._alpha = alpha;
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
        /**
         * The list of stored text layers that can be used to render 2D text, using smaller canvases with 2D rendering contexts superimposed
         * on the main canvas. (this way not the whole area of the canvas needs to be cleared for each frame, only the parts that contain
         * text)
         * @type TextLayer[]
         */
        this._textLayers = [];
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
            this._context = new managedGL.ManagedGLContext(this._canvas.getAttribute("id"), this._canvas, this._antialiasing, this._alpha, this._filtering);
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
    /**
     * Resizes the viewport of the wrapped canvas and any text layer canvases. To be called in case the window size changes.
     */
    ScreenCanvas.prototype.handleResize = function () {
        var
                width = this._canvas.clientWidth,
                height = this._canvas.clientHeight,
                i;
        if (this._canvas.width !== width ||
                this._canvas.height !== height) {
            // Change the size of the canvas to match the size it's being displayed
            this._canvas.width = width;
            this._canvas.height = height;
            for (i = 0; i < this._textLayers.length; i++) {
                this._textLayers[i].handleResize(width, height);
            }
        }
    };
    /**
     * Adds the passed text layer to the list of text layers rendered on top of this canvas.
     * @param {TextLayer} value
     */
    ScreenCanvas.prototype.addTextLayer = function (value) {
        this._textLayers.push(value);
        value.setContainer(this._canvas);
    };
    /**
     * Renders all the text layers that were added on top of this canvas.
     */
    ScreenCanvas.prototype.renderTextLayers = function () {
        var i;
        for (i = 0; i < this._textLayers.length; i++) {
            this._textLayers[i].render();
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
     * @param {Boolean|Object.<String, Boolean>} alpha Whether alpha channel support should be turned on for the GL contexts of the 
     * canvases of this screen. It can be specified altogether (Boolean) or on a per-canvas basis (Object storing Booleans for the
     * IDs of the canvases)
     * @param {String} filtering (enum managedGL.TextureFiltering) What texture filtering mode to use when rendering to a canvases of this screen
     * @param {Boolean} [useRequestAnimFrame=false] Whether to use the requestAnimationFrame API for the render loop
     * (as opposed to setInterval)
     * @param {Object.<String, Function>} [eventHandlers] Event handler functions to be executed when something happens to this page, by the
     * names of the events as keys
     * @param {Object.<String, Function>} [keyCommands] Event handler functions to be executed
     * while this screen is active, by the names of the keys (as in utils.getKeyCodeOf())
     * @param {Object.<String, Object.<String, Function>>} [elementEventHandlers] See HTMLScreen
     */
    function HTMLScreenWithCanvases(name, htmlFilename, style, antialiasing, alpha, filtering, useRequestAnimFrame, eventHandlers, keyCommands, elementEventHandlers) {
        HTMLScreen.call(this, name, htmlFilename, style, eventHandlers, keyCommands, elementEventHandlers);
        /**
         * Whether antialiasing should be turned on for the GL contexts of the canvases of this screen
         * @type Boolean
         */
        this._antialiasing = antialiasing;
        /**
         * Whether alpha channel support should be turned on for the GL contexts of the 
         * canvases of this screen. It can be specified altogether (Boolean) or on a per-canvas basis (Object storing Booleans for the
         * IDs of the canvases)
         * @type Boolean|Object.<String, Boolean>
         */
        this._alpha = alpha;
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
         * Stores all the active bindings that exist between the canvases of this screen and WebGL (SceneGraph)
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
        this._renderTimes = [];
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
        if (this._renderLoop === LOOP_CANCELED) {
            this.render();
        }
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
     * @returns {Boolean}
     */
    HTMLScreenWithCanvases.prototype.hide = function () {
        if (HTMLScreen.prototype.hide.call(this)) {
            this.stopRenderLoop();
            return true;
        }
        return false;
    };
    /**
     * Returns whether the alpha channel should be turned on for the canvas with the given name on this screen.
     * @param {String} canvasName The name of the canvas (the id of the canvas element without the page specific
     * prefixes)
     * @returns {Boolean}
     */
    HTMLScreenWithCanvases.prototype._getAlphaForCanvas = function (canvasName) {
        if (typeof this._alpha === "boolean") {
            return this._alpha;
        }
        if (typeof this._alpha[canvasName] === "boolean") {
            return this._alpha[canvasName];
        }
        application.showError("No alpha channel support is defined for canvas '" + canvasName + "' of screen '" + this._name + "'!");
        return false;
    };
    /**
     * @override
     * Initializes the components of the parent class, then the additional ones for
     * this class (the canvases).
     */
    HTMLScreenWithCanvases.prototype._initializeComponents = function () {
        var canvasElements, i;
        HTMLScreen.prototype._initializeComponents.call(this);
        canvasElements = this._container.getElementsByTagName("canvas");
        for (i = 0; i < canvasElements.length; i++) {
            this._canvases[canvasElements[i].getAttribute("id")] = new ScreenCanvas(
                    canvasElements[i],
                    this._antialiasing,
                    this._getAlphaForCanvas(this._getOriginalElementID(canvasElements[i])),
                    this._filtering);
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
        var i, canvasNames;
        canvasNames = Object.keys(this._canvases);
        for (i = 0; i < this._sceneCanvasBindings.length; i++) {
            this._sceneCanvasBindings[i].scene.cleanUp();
            this._sceneCanvasBindings[i].scene.render(this._sceneCanvasBindings[i].canvas.getManagedContext(), dt);
        }
        for (i = 0; i < canvasNames.length; i++) {
            this._canvases[canvasNames[i]].renderTextLayers();
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
        if (this._renderLoop === LOOP_CANCELED) {
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
        }
    };
    /**
     * Stops the render loop.
     */
    HTMLScreenWithCanvases.prototype.stopRenderLoop = function () {
        if (this._renderLoop !== LOOP_CANCELED) {
            if (!this._useRequestAnimFrame) {
                clearInterval(this._renderLoop);
            }
            this._renderLoop = LOOP_CANCELED;
            this._renderTimes = [];
        }
    };
    /**
     * Returns the Frames Per Second count for this screen's render loop.
     * @returns {Number}
     */
    HTMLScreenWithCanvases.prototype.getFPS = function () {
        return this._renderTimes.length;
    };
    /**
     * Updates all needed variables when the screen is resized.
     */
    HTMLScreenWithCanvases.prototype.resizeCanvases = function () {
        var canvasName;
        // first, update the canvas width and height properties if the client width/
        // height has changed
        for (canvasName in this._canvases) {
            if (this._canvases.hasOwnProperty(canvasName)) {
                if (this._canvases[canvasName].isResizeable() === true) {
                    this._canvases[canvasName].handleResize();
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
     * @param {Object.<String, Function>} [eventHandlers] Event handler functions for BOTH the screen AND THE MenuComponent ON THE SCREEN!
     * @param {Object.<String, Function>} [keyCommands] Event handler functions to be executed
     * while this screen is active, by the names of the keys (as in utils.getKeyCodeOf())
     * @param {Object.<String, Object.<String, Function>>} [elementEventHandlers] See HTMLScreen
     */
    function MenuScreen(name, htmlFilename, style, menuHTMLFilename, menuStyle, menuOptions, menuContainerID, eventHandlers, keyCommands, elementEventHandlers) {
        HTMLScreen.call(this, name, htmlFilename, style, eventHandlers, this._getKeyCommands(keyCommands), elementEventHandlers);
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
                        this._menuOptions,
                        eventHandlers),
                this._menuContainerID);
    }
    MenuScreen.prototype = new HTMLScreen();
    MenuScreen.prototype.constructor = MenuScreen;
    /**
     * Adds the default menu key commands (up-down-enter) to the given key commands object and returns the
     * result.
     * @param {Object.<String, Function>} [keyCommands] If not given, an object with just the default commands
     * will be returned.
     */
    MenuScreen.prototype._getKeyCommands = function (keyCommands) {
        keyCommands = keyCommands || {};
        keyCommands.up = keyCommands.up || function () {
            this._menuComponent.selectPrevious();
        }.bind(this);
        keyCommands.down = keyCommands.down || function () {
            this._menuComponent.selectNext();
        }.bind(this);
        keyCommands.enter = keyCommands.enter || function () {
            this._menuComponent.activateSelected();
        }.bind(this);
        return keyCommands;
    };
    /**
     * @override
     * @param {Boolean} active
     */
    MenuScreen.prototype.setActive = function (active) {
        HTMLScreen.prototype.setActive.call(this, active);
        this._menuComponent.unselect();
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ELEMENT_ID_SEPARATOR: ELEMENT_ID_SEPARATOR,
        HTMLScreen: HTMLScreen,
        CanvasText: CanvasText,
        ClipSpaceLayout: ClipSpaceLayout,
        TextLayer: TextLayer,
        HTMLScreenWithCanvases: HTMLScreenWithCanvases,
        MenuScreen: MenuScreen
    };
});