/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, document */

/**
 * @param utils Used for formatted strings when setting component content
 * @param application Used for logging, displaying errors and loading files.
 * @param asyncResource Used for managing asynchronous loading of components from files (subclassing AsyncResource)
 * @param strings Used for translation support
 */
define([
    "utils/utils",
    "modules/application",
    "modules/async-resource",
    "modules/strings"
], function (utils, application, asyncResource, strings) {
    "use strict";
    /**
     * @typedef {Object} Components~ModelLoadInfoObject
     * Stores a model and its loading state
     * @property {Boolean} requested
     * @property {HTMLDocument} model
     * @property {Function[]} onLoadQueue
     */
    /**
     * @typedef {Object} Components~LabelDescriptor
     * Stores the data based on which the text of an HTML element that is used as a
     * label can be determined.
     * @property {String} [caption] A static caption to be used on the label.
     * @property {String} [id] An ID that can be used as a translation key for the
     * text on the label for auto-translation.
     */
    var
            // ------------------------------------------------------------------------------
            // constants
            /**
             * The id attributes of the HTML elements are separated from the name of their
             * parent components by this string to create their unique ID among the elements
             * on the same screen
             * @type String
             */
            ELEMENT_ID_SEPARATOR = "_",
            /**
             * ID of the folder containing the component source HTML files
             * @type String
             */
            COMPONENT_FOLDER = "component",
            CSS_FOLDER = "css",
            LOADING_BOX_PROGRESS_ID = "progress",
            LOADING_BOX_STATUS_PARAGRAPH_ID = "status",
            LOADING_BOX_HEADER_ID = "header",
            INFO_BOX_MESSAGE_PARAGRAPH_ID = "message",
            INFO_BOX_OK_BUTTON_ID = "okButton",
            INFO_BOX_HEADER_ID = "header",
            SELECTOR_PROPERTY_LABEL_ID = "property",
            SELECTOR_VALUE_BUTTON_ID = "value",
            ENTER_CODE = 13,
            // ------------------------------------------------------------------------------
            // constants
            /**
             * Stores the loaded DOM models and their associated loading states and queued
             * functions for each HTML file that the components use, by the names of the
             * files
             * @type Object.<String, Components~ModelLoadInfoObject>
             */
            _modelLoadInfo = {};
    // ------------------------------------------------------------------------------
    // private functions
    // a set of module functions to manage a common pool of DOM models about HTML files
    // that the components use so they can be reused, as likely components of the same
    // class will use the same HTML file
    /**
     * Returns whether the DOM model has already been loaded and is available for the
     * HTML file with the passed name
     * @param {String} sourceFileName
     * @returns {Boolean}
     */
    function _isModelLoadedForSource(sourceFileName) {
        return _modelLoadInfo[sourceFileName] && !!_modelLoadInfo[sourceFileName].model;
    }
    /**
     * Returns the loaded DOM model for the HTML file with the passed name
     * @param {String} sourceFileName
     * @returns {HTMLDocument}
     */
    function _getModelForSource(sourceFileName) {
        return _modelLoadInfo[sourceFileName] && _modelLoadInfo[sourceFileName].model;
    }
    /**
     * Returns whether the loading of the HTML file with the passed name has already been
     * requested
     * @param {type} sourceFileName
     * @returns {Boolean}
     */
    function _isModelRequestedForSource(sourceFileName) {
        return _modelLoadInfo[sourceFileName] && _modelLoadInfo[sourceFileName].requested;
    }
    /**
     * If needed, initiates the loading of the HTML file with the passed name, and makes sure
     * the callback function is executed once the file has been loaded and its DOM model has
     * been created. If no loading is needed, the callback is executed right away (synchronously)
     * @param {String} sourceFileName
     * @param {Function} callback
     */
    function _requestModelForSource(sourceFileName, callback) {
        if (!_isModelRequestedForSource(sourceFileName)) {
            _modelLoadInfo[sourceFileName] = {};
            _modelLoadInfo[sourceFileName].requested = true;
            _modelLoadInfo[sourceFileName].onLoadQueue = [callback];
            // send an asynchronous request to grab the HTML file
            application.requestTextFile(COMPONENT_FOLDER, sourceFileName, function (responseText) {
                var i;
                // once the files has been loaded, create annd save the DOM model and execute all
                // queued functions
                _modelLoadInfo[sourceFileName].model = document.implementation.createHTMLDocument();
                _modelLoadInfo[sourceFileName].model.documentElement.innerHTML = responseText;
                for (i = 0; i < _modelLoadInfo[sourceFileName].onLoadQueue.length; i++) {
                    _modelLoadInfo[sourceFileName].onLoadQueue[i]();
                }
            });
        } else {
            // if the model has been requested, but is not loaded yet, put the callback function
            // in the execution queue
            if (!_isModelLoadedForSource(sourceFileName)) {
                _modelLoadInfo[sourceFileName].onLoadQueue.push(callback);
            } else {
                // if we have the model already, execute the callback right away
                if (callback) {
                    callback();
                }
            }
        }
    }
    /**
     * Returns the text that should be shown on a label that uses the passed descriptor.
     * @param {Components~LabelDescriptor} labelDescriptor
     * @returns {String}
     */
    function _getLabelText(labelDescriptor) {
        return labelDescriptor.caption || strings.get({name: labelDescriptor.id});
    }
    // ------------------------------------------------------------------------------
    // public functions
    /**
     * Deletes the references to DOM models stored for external component sources files.
     * After all components have been added to the page, these models become unnecessary
     * and can be deleted.
     */
    function clearStoredDOMModels() {
        _modelLoadInfo = {};
    }
    // #########################################################################
    /**
     * @class A wrapper class around a regular HTML5 element, that makes it easier
     * to integrate its functionality into a screen. Provides several
     * methods that are called automatically by the screen at certain points as well
     * as some that can be called on-demand and only serve to make code more readable.
     * @param {String} name The name of the component ot identify it.
     * @param {String} [elementID]  The id attribute of the HTML5 element this component
     * wraps. If omitted, it will have the same value as name.
     */
    function SimpleComponent(name, elementID) {
        /**
         * The name of the component. 
         * @type String
         */
        this._name = name;
        /**
         * The id attribute of the HTML5 element must have this value for successful initialization.
         * @type String
         */
        this._elementID = elementID || name;
        /**
         * The DOM object of the wrapped HTML element.
         * @type HTMLElement
         */
        this._element = null;
        /**
         * The (initial) display CSS property of the HTML element.
         * @type String
         */
        this._displayStyle = null;
    }
    /**
     * Return the name that identifies this component (within its screen / external component)
     * @returns {String}
     */
    SimpleComponent.prototype.getName = function () {
        return this._name;
    };
    /**
     * Sets a new element ID - either for later initialization or along with resetting the id of the
     * actual wrapped element.
     * @param {String} elementID
     */
    SimpleComponent.prototype.setElementID = function (elementID) {
        this._elementID = elementID;
        if (this._element) {
            this._element.setAttribute("id", this._elementID);
        }
    };
    /**
     * Returns the wrapped HTML element.
     * @returns {HTMLElement}
     */
    SimpleComponent.prototype.getElement = function () {
        return this._element;
    };
    /**
     * Returns the inner HTML text content of the wrapped element.
     * @returns {String}
     */
    SimpleComponent.prototype.getContent = function () {
        return this._element.innerHTML;
    };
    /**
     * Sets the inner HTML text content of the wrapped element.
     * @param {String} newContent
     * @param {Object} [replacements] If given, the newContent string will be used as a format string and the named values given in this
     * object will be replaced in it
     */
    SimpleComponent.prototype.setContent = function (newContent, replacements) {
        this._element.innerHTML = replacements ? utils.formatString(newContent, replacements) : newContent;
    };
    /**
     * Replaces the named parameters in the inner HTML text content of the wrapped elements to the values defined in the passed object.
     * @param {Object} replacements
     */
    SimpleComponent.prototype.customizeContent = function (replacements) {
        this._element.innerHTML = utils.formatString(this._element.innerHTML, replacements);
    };
    /**
     * Grabs the element and the display style from the current HTML document. Needs
     * to be called after the wrapped element has been appended to the document.
     * (automatically called by screens after append)
     */
    SimpleComponent.prototype.initComponent = function () {
        this._element = document.getElementById(this._elementID);
        if (!this._element) {
            application.showError(
                    "Cannot initialize component: '" + this._name + "'!",
                    application.ErrorSeverity.SEVERE,
                    "No element can be found on the page with a corresponding ID: '" + this._elementID + "'!");
        } else {
            this._displayStyle = this._element.style.display;
        }
    };
    /**
     * Nulls the element and the display style. Needs to be called if the element
     * has been removed from the current document.
     */
    SimpleComponent.prototype.resetComponent = function () {
        this._element = null;
        this._displayStyle = null;
    };
    /**
     * Returns whether the component is currently visible.
     * @returns {Boolean}
     */
    SimpleComponent.prototype.isVisible = function () {
        return (this._element.style.display !== "none");
    };
    /**
     * Hides the wrapped HTML element by setting its display CSS property.
     */
    SimpleComponent.prototype.hide = function () {
        this._element.style.display = "none";
    };
    /**
     * Shows (reveals) the wrapped HTML element by setting its display CSS property.
     */
    SimpleComponent.prototype.show = function () {
        this._element.style.display = this._displayStyle;
    };
    // #########################################################################
    /**
     * @typedef {Object} ExternalComponent~Style
     * A style descriptor for an external component storing the name of the CSS file
     * associated with the component as well as class names for dynamically created
     * HTML elements.
     * @property {String} cssFilename
     */
    /**
     * @class A reusable component that consist of HTML elements (a fragment of a 
     * HTML document, stored in an external file, hence the name) and can be appended 
     * to screens. Specific components can be the descendants of this 
     * class, and implement their own various methods.
     * @extends AsyncResource
     * @param {String} name The name of the component to be identified by. Names
     * must be unique within one screen.
     * @param {String} htmlFilename The filename of the HTML document where the structure
     * of the component should be defined. The component will be loaded as the first
     * element (and all its children) inside the body tag of this file.
     * @param {ExternalComponent~Style} [style] An object storing the name of the CSS
     * file that contains the styling rules and for this component and the desired classes for  
     * dynamically created elements.
     */
    function ExternalComponent(name, htmlFilename, style) {
        asyncResource.AsyncResource.call(this);
        /**
         * The name of the component to be identified by.
         * @type String
         */
        this._name = name;
        /**
         * The root element will be set to this id and the contained named elements will be prefixed
         * with this id once the component is added to the page.
         * @type String
         */
        this._rootElementID = name;
        /**
         * The filename of the HTML document where the structure of the component should be defined.
         * @type String
         */
        this._htmlFilename = htmlFilename;
        /**
         * An object storing the name of the CSS file that contains the styling rules and for this 
         * components and the desired classes for dynamically created elements.
         * @type ExternalComponent~Style
         */
        this._style = style || {};
        /**
         * The root HTML element of the structure of this component on the screen it has been added to.
         * @type HTMLElement
         */
        this._rootElement = null;
        /**
         * The initial value of the CSS display property of the root element. Store 
         * to enable us to restore it after hiding it with display: none.
         * @type String
         */
        this._rootElementDefaultDisplayMode = null;
        /**
         * A flag that marks whether loading the correspoding CSS stylesheet has finished.
         * @type Boolean
         */
        this._cssLoaded = false;
        /**
         * The array of contained simple components. The components in this array
         * are automatically managed (initialization and reset).
         * @type SimpleComponent[]
         */
        this._simpleComponents = [];
        // Subclasses will call this constructor to set their prototype without any
        // parameters, therefore make sure we don't attempt to load from "undefined"
        // source.
        if (htmlFilename) {
            this.requestModelLoad();
        }
    }
    ExternalComponent.prototype = new asyncResource.AsyncResource();
    ExternalComponent.prototype.constructor = ExternalComponent;
    ExternalComponent.prototype.getName = function () {
        return this._name;
    };
    /**
     * The root element will be set to the given id and the contained named elements will be prefixed
     * with this id once the component is added to the page. This can only be called before the component
     * is added to the page!
     * @param {String} rootElementID
     */
    ExternalComponent.prototype.setRootElementID = function (rootElementID) {
        var i;
        if (!this._rootElement) {
            this._rootElementID = rootElementID;
            for (i = 0; i < this._simpleComponents.length; i++) {
                this._simpleComponents[i].setElementID(this._getElementID(this._simpleComponents[i].getName()));
            }
        } else {
            application.showError("Attempting to change the root element ID for external component '" + this._name + "' after it has already been added to the page!");
        }
    };
    /**
     * Initiates the asynchronous loading of the component's structure from the
     * external HTML file and potential styling from the external CSS style.
     */
    ExternalComponent.prototype.requestModelLoad = function () {
        if (this._style.cssFilename) {
            this._cssLoaded = false;
            application.requestCSSFile(CSS_FOLDER, this._style.cssFilename, function () {
                this._cssLoaded = true;
                if (_isModelLoadedForSource(this._htmlFilename)) {
                    this.setToReady();
                }
            }.bind(this));
        } else {
            this._cssLoaded = true;
        }
        // if needed, initiate the request to get the HTML source file
        _requestModelForSource(this._htmlFilename, function () {
            if (this._cssLoaded === true) {
                this.setToReady();
            }
        }.bind(this));
    };
    /**
     * Appends the component's elements to the current document. This is called by the addExternalComponent
     * method of the screens when they are added to the page, which happens only after the DOM models for
     * the screen and all its components have been loaded. Do not call this manually.
     * @param {Node} [parentNode=document.body] The component will be appended as child of this node.
     */
    ExternalComponent.prototype.appendToPage = function (parentNode) {
        var namedElements, i;
        parentNode = parentNode || document.body;
        this._rootElement = parentNode.appendChild(document.importNode(_getModelForSource(this._htmlFilename).body.firstElementChild, true));
        this._rootElement.setAttribute("id", this._rootElementID);
        this._rootElementDefaultDisplayMode = this._rootElement.style.display;
        // All elements with an "id" attribute within this structure have to
        // be renamed to make sure their id does not conflict with other elements
        // in the main document (such as elements of another instance of the
        // same external component), when they are appended. Therefore prefix
        // their id with the name of this component. (which is unique within
        // a game screen, and is prefixed with the name of the game screen,
        // which is uniqe within the game, thus fulfilling the requirement of
        // overall uniqueness)
        namedElements = this._rootElement.querySelectorAll("[id]");
        for (i = 0; i < namedElements.length; i++) {
            namedElements[i].setAttribute("id", this._getElementID(namedElements[i].getAttribute("id")));
        }
        this._initializeComponents();
    };
    /**
     * Returns appropriately prefixed version of the original, passed ID that would correspond
     * to the ID of an element of this component.
     * @param {String} originalElementID
     * @returns {String}
     */
    ExternalComponent.prototype._getElementID = function (originalElementID) {
        return this._rootElementID + ELEMENT_ID_SEPARATOR + originalElementID;
    };
    /**
     * Returns the ID of the passed element without the prefix referencing to this component
     * @param {Element} element
     * @returns {String}
     */
    ExternalComponent.prototype._getOriginalElementID = function (element) {
        return element.getAttribute("id").substr(this._rootElementID.length + ELEMENT_ID_SEPARATOR.length);
    };
    /**
     * Setting the properties that will be used to easier access DOM elements later.
     * In subclasses, this method should be overloaded if custom properties need
     * to be initialized (registered simple components are already imitialized here
     * automatically.
     */
    ExternalComponent.prototype._initializeComponents = function () {
        var i;
        if (this._rootElement) {
            for (i = 0; i < this._simpleComponents.length; i++) {
                this._simpleComponents[i].initComponent();
            }
        } else {
            application.log("WARNING! Attempting to initaialize external component " + this._name + " before appending it to the page! It will be initialized automatically once it is added.");
        }
    };
    /**
     * If possible, updates the inner HTML text of the child elements to the translation in the current language.
     * (it is possible, if the child element was given an ID that is a valid translation key)
     */
    ExternalComponent.prototype.updateComponents = function () {
        var i, namedElements;
        if (this._rootElement) {
            namedElements = this._rootElement.querySelectorAll("[id]");
            for (i = 0; i < namedElements.length; i++) {
                namedElements[i].innerHTML = strings.get({
                    name: this._getOriginalElementID(namedElements[i]),
                    defaultValue: namedElements[i].innerHTML
                });
            }
        } else {
            application.log("WARNING! Attempting to update external component " + this._name + " before appending it to the page!");
        }
    };
    /**
     * Adds a new simple component with the specified name (prefixed with the name
     * of this component, as id attributes are also prefixed when the component is
     * appended to the document), and also returns it.
     * @param {String} simpleComponentName This name will be automatically
     * prefixed with the external component's name when the simple component is created.
     * @returns {SimpleComponent}
     */
    ExternalComponent.prototype.registerSimpleComponent = function (simpleComponentName) {
        var component = new SimpleComponent(simpleComponentName, this._getElementID(simpleComponentName));
        this._simpleComponents.push(component);
        return component;
    };
    /**
     * When the screen is destroyed, references to the DOM elements should be removed.
     * In subclasses, this method should be overloaded, clearing the additional
     * properties.
     */
    ExternalComponent.prototype.resetComponent = function () {
        var i;
        this.resetResource();
        for (i = 0; i < this._simpleComponents.length; i++) {
            this._simpleComponents[i].resetComponent();
        }
    };
    /**
     * Sets the display CSS property of the root element of the component to show it.
     */
    ExternalComponent.prototype.show = function () {
        if (this._rootElement) {
            this._rootElement.style.display = this._rootElementDefaultDisplayMode;
        } else {
            application.log("WARNING! Attempting to show external component " + this._name + " before appending it to the page!");
        }
    };
    /**
     * Sets the display CSS property of the root element of the component to hide it.
     */
    ExternalComponent.prototype.hide = function () {
        if (this._rootElement) {
            this._rootElement.style.display = "none";
        } else {
            application.log("WARNING! Attempting to hide external component " + this._name + " before appending it to the page!");
        }
    };
    // #########################################################################
    /**
     * @class A loading box component, that has a title, a progress bar and a status
     * message. Hidden upon initialization by default.
     * @extends ExternalComponent
     * @param {String} name See ExternalComponent.
     * @param {String} htmlFilename See ExternalComponent.
     * @param {ExternalComponent~Style} [style] See ExternalComponent.
     * @param {String} [headerID] If given, the header element will get this ID
     * (prefixed with the component name), making it possible to auto-translate it
     * using the same string key as this ID
     */
    function LoadingBox(name, htmlFilename, style, headerID) {
        ExternalComponent.call(this, name, htmlFilename, style);
        /**
         * @type SimpleComponent
         */
        this._progress = this.registerSimpleComponent(LOADING_BOX_PROGRESS_ID);
        /**
         * @type SimpleComponent
         */
        this._status = this.registerSimpleComponent(LOADING_BOX_STATUS_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._header = this.registerSimpleComponent(LOADING_BOX_HEADER_ID);
        /**
         * If set, the header element gets this ID (prefixed with the component 
         * name), making it possible to auto-translate it using the same string key as this ID
         * @type String
         */
        this._headerID = headerID;
    }
    LoadingBox.prototype = new ExternalComponent();
    LoadingBox.prototype.constructor = LoadingBox;
    /**
     * @override
     * Initializes the contained simple components and hides the box.
     */
    LoadingBox.prototype._initializeComponents = function () {
        ExternalComponent.prototype._initializeComponents.call(this);
        if (this._rootElement) {
            if (this._headerID) {
                this._header.setElementID(this._getElementID(this._headerID));
            }
            this.hide();
        }
    };
    /**
     * Updates the maximum value of the progress bar shown on the loading box.
     * @param {Number} value 
     */
    LoadingBox.prototype.setMaxProgress = function (value) {
        if (this._rootElement) {
            this._progress.getElement().max = value;
        } else {
            application.log("WARNING! Attempting to update the maximum progress value of loading box" + this._name + " before appending it to the page!");
        }
    };
    /**
     * Updates the value of the progress bar shown on the loading box.
     * @param {Number} value The new value of the progress bar.
     */
    LoadingBox.prototype.updateProgress = function (value) {
        if (this._rootElement) {
            this._progress.getElement().value = value;
        } else {
            application.log("WARNING! Attempting to update the progress value of loading box" + this._name + " before appending it to the page!");
        }
    };
    /**
     * Updates the status message, and optionally the progress value shown on the loading box.
     * @param {String} status The new status to show.
     * @param {Object} [replacements] If given the status string will be considered a format string, and its
     * placeholders will be replaced according to the properties of this object
     * @param {Number} [progress] The new progress value to show
     */
    LoadingBox.prototype.updateStatus = function (status, replacements, progress) {
        if (this._rootElement) {
            this._status.setContent(status, replacements);
            if (progress !== undefined) {
                this.updateProgress(progress);
            }
        } else {
            application.log("WARNING! Attempting to update the status message of loading box" + this._name + " before appending it to the page!");
        }
    };
    // #########################################################################
    /**
     * @class An info box component, that has a title, and a message to tell to the
     * user. Hidden upon initialization by default.
     * @extends ExternalComponent
     * @param {String} name See ExternalComponent.
     * @param {String} htmlFilename See ExternalComponent.
     * @param {ExternalComponent~Style} [style] See ExternalComponent.
     * @param {Function} [onShow] The function to execute every time the box is shown.
     * @param {Function} [onHide] The function to execute every time the box is hidden.
     * @param {String} [headerID] If given, the header element will get this ID
     * (prefixed with the component name), making it possible to auto-translate it
     * using the same string key as this ID
     * @param {String} [okButtonID] If given, the OK button element will get this ID
     * (prefixed with the component name), making it possible to auto-translate it
     * using the same string key as this ID
     */
    function InfoBox(name, htmlFilename, style, onShow, onHide, headerID, okButtonID) {
        ExternalComponent.call(this, name, htmlFilename, style);
        /**
         * @type SimpleComponent
         */
        this._message = this.registerSimpleComponent(INFO_BOX_MESSAGE_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._okButton = this.registerSimpleComponent(INFO_BOX_OK_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._header = this.registerSimpleComponent(INFO_BOX_HEADER_ID);
        /**
         * If set, the header element gets this ID (prefixed with the component name), making
         * it possible to auto-translate it using the same string key as this ID
         * @type String
         */
        this._headerID = headerID;
        /**
         * If set, the OK button element gets this ID (prefixed with the component name), making
         * it possible to auto-translate it using the same string key as this ID
         * @type String
         */
        this._okButtonID = okButtonID;
        /**
         * A function that will be run every time box is shown.
         * @type Function
         */
        this._onShow = (onShow !== undefined) ? onShow : null;
        /**
         * A function that will be run every time box is hidden.
         * @type Function
         */
        this._onHide = (onHide !== undefined) ? onHide : null;
        /**
         * A keyboard event handler that can be added to the document when the box is
         * shown to allow closing it by pressing enter, not just clicking on the button.
         * This needs to be a privileged method so that it can always access the 
         * original info box instance, no matter where is it called from.
         * @type Function
         * @param {KeyboardEvent} event
         */
        this._handleKeyUp = function (event) {
            if (event.keyCode === ENTER_CODE) {
                this.hide();
            }
        }.bind(this);
    }
    InfoBox.prototype = new ExternalComponent();
    InfoBox.prototype.constructor = InfoBox;
    /**
     * Initializes the contained simple components, set the event handler for the
     * button and hides the box.
     */
    InfoBox.prototype._initializeComponents = function () {
        ExternalComponent.prototype._initializeComponents.call(this);
        if (this._rootElement) {
            if (this._headerID) {
                this._header.setElementID(this._getElementID(this._headerID));
            }
            if (this._okButtonID) {
                this._okButton.setElementID(this._getElementID(this._okButtonID));
            }
            this._okButton.getElement().onclick = function () {
                this.hide();
                return false;
            }.bind(this);
            // at initialization, do not yet run the onHide function, since the box has
            // not been shown yet
            ExternalComponent.prototype.hide.call(this);
        }
    };
    /**
     * Shows the info box and executes the _onShow function. (if set)
     */
    InfoBox.prototype.show = function () {
        ExternalComponent.prototype.show.call(this);
        document.addEventListener("keyup", this._handleKeyUp);
        if (this._onShow) {
            this._onShow();
        }
    };
    /**
     * Hides the info box and executes the _onHide function. (if set)
     */
    InfoBox.prototype.hide = function () {
        ExternalComponent.prototype.hide.call(this);
        document.removeEventListener("keyup", this._handleKeyUp);
        if (this._onHide) {
            this._onHide();
        }
    };
    /**
     * Updates the message shown on the info box.
     * @param {String} message The new message to show.
     * @param {Object} [replacements] If given the status string will be considered a format string, and its
     * placeholders will be replaced according to the properties of this object
     */
    InfoBox.prototype.updateMessage = function (message, replacements) {
        if (this._rootElement) {
            this._message.setContent(message, replacements);
        } else {
            application.log("WARNING! Attempting to update the message of info box" + this._name + " before appending it to the page!");
        }
    };
    // #########################################################################
    /**
     * @typedef {ExternalComponent~Style} MenuComponent~Style
     * @property {String} menuClassName
     * @property {String} buttonClassName
     * @property {String} buttonContainerClassName
     */
    /**
     * @typedef {Components~LabelDescriptor} MenuComponent~MenuOption
     * @property {Function} action The function to execute 
     */
    /**
     * @class A component that consists of a container and a list of menu options
     * inside, which execute given functions when clicked on
     * @extends ExternalComponent
     * @param {String} name See ExternalComponent.
     * @param {String} htmlFilename See ExternalComponent
     * @param {MenuComponent~Style} [style] See ExternalComponent
     * @param {MenuComponent~MenuOption[]} menuOptions An array of the available menu options
     */
    function MenuComponent(name, htmlFilename, style, menuOptions) {
        ExternalComponent.call(this, name, htmlFilename, style);
        /**
         * An array of the available menu options, each described by an object with 
         * a caption (String) and an action (Function) property.
         * @type MenuComponent~MenuOption[]
         */
        this._menuOptions = menuOptions;
    }
    MenuComponent.prototype = new ExternalComponent();
    MenuComponent.prototype.constructor = MenuComponent;
    /**
     * The return value of the click handler on a link decides whether the link path 
     * should be followed or not. By making sure it is false, the links serving as 
     * buttons in the menu will not bring the user back to the top of the page 
     * (because href is #). This function returns a function that executes the action
     * for the button of the given index, and then returns false to be used as a click
     * event handler.
     * @param {Number} index
     * @returns {Function}
     */
    MenuComponent.prototype.getMenuClickHandler = function (index) {
        return function () {
            this._menuOptions[index].action();
            return false;
        }.bind(this);
    };
    /**
     * Sets up the menu by appending the buttons to the container.
     */
    MenuComponent.prototype._initializeComponents = function () {
        var i, aElement, liElement;
        ExternalComponent.prototype._initializeComponents.call(this);
        if (this._rootElement) {
            for (i = 0; i < this._menuOptions.length; i++) {
                aElement = document.createElement("a");
                if (this._menuOptions[i].id) {
                    aElement.id = this._getElementID(this._menuOptions[i].id);
                }
                aElement.href = "#";
                aElement.className = (this._style.menuClassName || "") + " " + (this._style.buttonClassName || "");
                aElement.innerHTML = _getLabelText(this._menuOptions[i]);
                // we need to generate an appropriate handler function here for each
                // menu element (cannot directly create it here as they would all use
                // the same index as i would be a closure)
                aElement.onclick = this.getMenuClickHandler(i);
                liElement = document.createElement("li");
                liElement.className = (this._style.buttonContainerClassName || "");
                liElement.appendChild(aElement);
                this._rootElement.appendChild(liElement);
            }
        }
    };
    // #########################################################################
    /**
     * @class A component that consists of a label describing a property, and a
     * button that can be clicked to select from a list of possible values for that
     * property. (suitable for properties with a small amount of possible values, 
     * as each click will show the next value, and when the last is reached, the 
     * cycle will begin again)
     * @extends ExternalComponent
     * @param {String} name See ExternalComponent.
     * @param {String} htmlFilename See ExternalComponent.
     * @param {ExternalComponent~Style} [style] See ExternalComponent.
     * @param {Components~LabelDescriptor} propertyLabelDescriptor The caption and id of the property label element that is displayed on this
     * selector, indicating what property can be set with it
     * @param {String[]} valueList The list of possible values that can be selected
     * for the property.
     */
    function Selector(name, htmlFilename, style, propertyLabelDescriptor, valueList) {
        ExternalComponent.call(this, name, htmlFilename, style);
        /**
         * The name of the property that can be set using this selector.
         * @type Components~LabelDescriptor
         */
        this._propertyLabelDescriptor = propertyLabelDescriptor;
        /**
         * The list of possible values that can be selected with this selector.
         * @type String[]
         */
        this._valueList = valueList;
        /**
         * The index of the currently selected value.
         * @type Number
         */
        this._valueIndex = 0;
        /**
         * A wrapper for the HTML element containing the label caption for the property
         * this selector sets.
         * @type SimpleComponent
         */
        this._propertyLabel = this.registerSimpleComponent(SELECTOR_PROPERTY_LABEL_ID);
        /**
         * A wrapper for the HTML element which serves as the selector button to select
         * from the available values.
         * @type SimpleComponent
         */
        this._valueSelector = this.registerSimpleComponent(SELECTOR_VALUE_BUTTON_ID);
        /**
         * A function to execute when the selected value has been changed.
         * @type Function
         */
        this.onChange = null;
    }
    Selector.prototype = new ExternalComponent();
    Selector.prototype.constructor = Selector;
    /**
     * Initializes the components, sets their text and sets the handler for the click
     * on the selector.
     */
    Selector.prototype._initializeComponents = function () {
        ExternalComponent.prototype._initializeComponents.call(this);
        if (this._rootElement) {
            if (this._propertyLabelDescriptor.id) {
                this._propertyLabel.setElementID(this._getElementID(this._propertyLabelDescriptor.id));
            }
            this._propertyLabel.setContent(_getLabelText(this._propertyLabelDescriptor));
            this._valueSelector.setContent(this._valueList[0]);
            this._valueIndex = 0;
            this._valueSelector.getElement().onclick = function () {
                this.selectNextValue();
                return false;
            }.bind(this);
        }
    };
    /**
     * Selects the value given as parameter from the list of available values.
     * @param {String} value
     */
    Selector.prototype.selectValue = function (value) {
        if (this._rootElement) {
            var i = 0;
            while ((i < this._valueList.length) && (this._valueList[i] !== value)) {
                i++;
            }
            if (i < this._valueList.length) {
                this.selectValueWithIndex(i);
            } else {
                application.showError(
                        "Attempted to select value: '" + value + "' for '" + this._propertyLabelDescriptor.caption || strings.get({name: this._propertyLabelDescriptor.id}) + "', which is not one of the available options.",
                        application.ErrorSeverity.MINOR);
            }
        } else {
            application.showError("Attemted to select value for selector " + this._name + " which is not yet appended to the page!");
        }
    };
    /**
     * Selects the value with the passed index from the list.
     * @param {Number} index
     */
    Selector.prototype.selectValueWithIndex = function (index) {
        if (this._rootElement) {
            if (this._valueList.length > index) {
                this._valueIndex = index;
                this._valueSelector.setContent(this._valueList[this._valueIndex]);
                if (this.onChange) {
                    this.onChange();
                }
            } else {
                application.showError(
                        "Attempted to select value with index '" + index + "' for '" + this._propertyName + "', while the available range is: 0-" + (this._valueList.length - 1),
                        application.ErrorSeverity.MINOR);
            }
        } else {
            application.showError("Attemted to select value for selector " + this._name + " which is not yet appended to the page!");
        }
    };
    /**
     * Returns the currently selected value.
     * @returns {String}
     */
    Selector.prototype.getSelectedValue = function () {
        return this._valueList[this._valueIndex];
    };
    /**
     * Returns the index of the currently selected value.
     * @returns {Number}
     */
    Selector.prototype.getSelectedIndex = function () {
        return this._valueIndex;
    };
    /**
     * Selects the next available value from the list. If the last value was selected,
     * selects the first one.
     */
    Selector.prototype.selectNextValue = function () {
        this.selectValueWithIndex((this._valueIndex + 1) % this._valueList.length);
    };
    /**
     * 
     * @param {String[]} valueList
     */
    Selector.prototype.setValueList = function (valueList) {
        this._valueList = valueList;
        if (this._valueIndex >= this._valueList.length) {
            this._valueIndex = 0;
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ELEMENT_ID_SEPARATOR: ELEMENT_ID_SEPARATOR,
        clearStoredDOMModels: clearStoredDOMModels,
        SimpleComponent: SimpleComponent,
        LoadingBox: LoadingBox,
        InfoBox: InfoBox,
        MenuComponent: MenuComponent,
        Selector: Selector
    };
});