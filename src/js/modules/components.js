/**
 * Copyright 2014-2018, 2020 Krisztián Nagy
 * @file Provides various classes that can be used integrated with the Screen module as components on screens. Also manages a shader cache
 * for storing the downloaded source (HTML and CSS) files of the created components.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

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
     * @property {DocumentFragment} model
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
            // Constants
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
            LOADING_BOX_STATUS_DIV_ID = "status",
            LOADING_BOX_HEADER_ID = "header",
            INFO_BOX_MESSAGE_PARAGRAPH_ID = "message",
            INFO_BOX_OK_BUTTON_ID = "okButton",
            INFO_BOX_HEADER_ID = "header",
            SELECTOR_PROPERTY_LABEL_ID = "property",
            SELECTOR_VALUE_BUTTON_ID = "value",
            SLIDER_PROPERTY_LABEL_ID = "property",
            SLIDER_ID = "slider",
            SLIDER_VALUE_LABEL_ID = "valueLabel",
            // key codes
            ENTER_CODE = 13,
            UP_CODE = 38,
            DOWN_CODE = 40,
            // CSS class names
            DISABLED_CLASS_NAME = "disabled",
            SELECTED_CLASS_NAME = "selected",
            HIGHLIGHTED_CLASS_NAME = "highlighted",
            // event names for passing event handlers when components are crated
            SHOW_EVENT_NAME = "show",
            HIDE_EVENT_NAME = "hide",
            ENABLE_EVENT_NAME = "enable",
            DISABLE_EVENT_NAME = "disable",
            SELECT_EVENT_NAME = "select",
            UNSELECT_EVENT_NAME = "unselect",
            BUTTON_SELECT_EVENT_NAME = "buttonselect",
            BUTTON_CLICK_EVENT_NAME = "buttonclick",
            OPTION_SELECT_EVENT_NAME = "optionselect",
            OPTION_CLICK_EVENT_NAME = "optionclick",
            ELEMENT_HIGHLIGHT_EVENT_NAME = "elementhighlight",
            ELEMENT_SELECT_EVENT_NAME = "elementselect",
            TRANSLATION_KEY_ATTRIBUTE = "data-translation-key",
            // ------------------------------------------------------------------------------
            // Private variables
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
                var i, helperDiv;
                // once the files has been loaded, create and save the DOM model
                _modelLoadInfo[sourceFileName].model = document.createDocumentFragment();
                // the DocumentFragment node has no innerHTML property, so we create a helper
                // HTML element so we can convert the source file's text content to DOM
                helperDiv = document.createElement("div");
                helperDiv.innerHTML = responseText;
                _modelLoadInfo[sourceFileName].model.appendChild(helperDiv.firstElementChild);
                // execute all queued functions
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
     * @param {Object.<String, Function>} [eventHandlers] The functions to execute when various events happen to this component
     */
    function SimpleComponent(name, elementID, eventHandlers) {
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
         * A function that runs whenever the component becomes visible.
         * @type Function
         */
        this._onShow = eventHandlers ? eventHandlers[SHOW_EVENT_NAME] : null;
        /**
         * A function that runs whenever the component becomes hidden.
         * @type Function
         */
        this._onHide = eventHandlers ? eventHandlers[HIDE_EVENT_NAME] : null;
        /**
         * A function that runs whenever the component becomes enabled.
         * @type Function
         */
        this._onEnable = eventHandlers ? eventHandlers[ENABLE_EVENT_NAME] : null;
        /**
         * A function that runs whenever the component becomes disabled.
         * @type Function
         */
        this._onDisable = eventHandlers ? eventHandlers[DISABLE_EVENT_NAME] : null;
        /**
         * A function that runs whenever the component becomes selected.
         * @type Function
         */
        this._onSelect = eventHandlers ? eventHandlers[SELECT_EVENT_NAME] : null;
        /**
         * A function that runs whenever the component becomes unselected.
         * @type Function
         */
        this._onUnselect = eventHandlers ? eventHandlers[UNSELECT_EVENT_NAME] : null;
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
     * Sets the inner HTML content (parsing the passed string) of the wrapped element.
     * @param {String} newContent
     * @param {Object} [replacements] If given, the newContent string will be used as a format string and the named values given in this
     * object will be replaced in it
     */
    SimpleComponent.prototype.setContent = function (newContent, replacements) {
        this._element.innerHTML = replacements ? utils.formatString(newContent, replacements) : newContent;
    };
    /**
     * Sets the inner text content of the wrapped element.
     * @param {String} newContent
     * @param {Object} [replacements] If given, the newContent string will be used as a format string and the named values given in this
     * object will be replaced in it
     */
    SimpleComponent.prototype.setTextContent = function (newContent, replacements) {
        this._element.textContent = replacements ? utils.formatString(newContent, replacements) : newContent;
    };
    /**
     * Replaces the named parameters in the inner HTML text content of the wrapped elements to the values defined in the passed object.
     * @param {Object} replacements
     */
    SimpleComponent.prototype.customizeContent = function (replacements) {
        this._element.innerHTML = utils.formatString(this._element.innerHTML, replacements);
    };
    /**
     * Returns the current value of an attribute of the wrapped HTML element
     * @param {String} name The name of the attribute to be checked
     * @returns {}
     */
    SimpleComponent.prototype.getAttribute = function (name) {
        return this._element[name];
    };
    /**
     * Sets a new value for an attribute of the wrapped HTML element
     * @param {String} name
     * @param {} value
     */
    SimpleComponent.prototype.setAttribute = function (name, value) {
        this._element[name] = value;
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
        }
    };
    /**
     * Nulls the element. Needs to be called if the element
     * has been removed from the current document.
     */
    SimpleComponent.prototype.resetComponent = function () {
        this._element = null;
    };
    /**
     * Returns whether the component is currently visible.
     * @returns {Boolean}
     */
    SimpleComponent.prototype.isVisible = function () {
        return !this._element.hidden;
    };
    /**
     * Hides the wrapped HTML element by setting its hidden attribute
     */
    SimpleComponent.prototype.hide = function () {
        if (this.isVisible()) {
            this._element.hidden = true;
            if (this._onHide) {
                this._onHide();
            }
        }
    };
    /**
     * Shows (reveals) the wrapped HTML element by setting its hidden attribute
     */
    SimpleComponent.prototype.show = function () {
        if (!this.isVisible()) {
            this._element.hidden = false;
            if (this._onShow) {
                this._onShow();
            }
        }
    };
    /**
     * Shows / hides the component, if needed to achieve the passed visibility (also calling the appropriate event handlers)
     * @param {Boolean} visible The desired visibility of the component
     */
    SimpleComponent.prototype.setVisible = function (visible) {
        if (visible) {
            this.show();
        } else {
            this.hide();
        }
    };
    /**
     * Returns whether the component is currently in enabled state.
     * @returns {Boolean}
     */
    SimpleComponent.prototype.isEnabled = function () {
        return !this._element.classList.contains(DISABLED_CLASS_NAME);
    };
    /**
     * Puts the component in disabled state.
     */
    SimpleComponent.prototype.disable = function () {
        if (this.isEnabled()) {
            this._element.classList.add(DISABLED_CLASS_NAME);
            if (this._onDisable) {
                this._onDisable();
            }
        }
    };
    /**
     * Puts the component in enabled state.
     */
    SimpleComponent.prototype.enable = function () {
        if (!this.isEnabled()) {
            this._element.classList.remove(DISABLED_CLASS_NAME);
            if (this._onEnable) {
                this._onEnable();
            }
        }
    };
    /**
     * Returns whether the component is currently in selected state.
     * @returns {Boolean}
     */
    SimpleComponent.prototype.isSelected = function () {
        return this._element.classList.contains(SELECTED_CLASS_NAME);
    };
    /**
     * Puts the component in selected state.
     */
    SimpleComponent.prototype.select = function () {
        if (!this.isSelected()) {
            this._element.classList.add(SELECTED_CLASS_NAME);
            if (this._onSelect) {
                this._onSelect();
            }
        }
    };
    /**
     * Puts the component in not selected state.
     */
    SimpleComponent.prototype.unselect = function () {
        if (this.isSelected()) {
            this._element.classList.remove(SELECTED_CLASS_NAME);
            if (this._onUnselect) {
                this._onUnselect();
            }
        }
        this._element.blur();
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
        this._rootElement = parentNode.appendChild(document.importNode(_getModelForSource(this._htmlFilename).firstElementChild, true));
        this._rootElement.setAttribute("id", this._rootElementID);
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
            application.log_DEBUG("WARNING! Attempting to initaialize external component " + this._name + " before appending it to the page! It will be initialized automatically once it is added.");
        }
    };
    /**
     * If possible, updates the inner HTML text of the child elements to the translation in the current language.
     * (it is possible, if the child element has a data-translation-key attribute with the value of the translation key)
     */
    ExternalComponent.prototype.updateComponents = function () {
        var i, elementsToTranslate;
        if (this._rootElement) {
            elementsToTranslate = this._rootElement.querySelectorAll("[" + TRANSLATION_KEY_ATTRIBUTE + "]");
            for (i = 0; i < elementsToTranslate.length; i++) {
                elementsToTranslate[i].innerHTML = strings.get({
                    name: elementsToTranslate[i].getAttribute(TRANSLATION_KEY_ATTRIBUTE),
                    defaultValue: elementsToTranslate[i].innerHTML
                });
            }
        } else {
            application.log_DEBUG("WARNING! Attempting to update external component " + this._name + " before appending it to the page!");
        }
    };
    /**
     * Adds a new simple component with the specified name (prefixed with the name
     * of this component, as id attributes are also prefixed when the component is
     * appended to the document), and also returns it.
     * @param {String} simpleComponentName This name will be automatically
     * prefixed with the external component's name when the simple component is created.
     * @param {Object.<String, Function>} [eventHandlers] Will be passed to the created SimpleComponent
     * @returns {SimpleComponent}
     */
    ExternalComponent.prototype.registerSimpleComponent = function (simpleComponentName, eventHandlers) {
        var component = new SimpleComponent(simpleComponentName, this._getElementID(simpleComponentName), eventHandlers);
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
     * Returns whether the component is currently set to be visible
     * @returns {Boolean}
     */
    ExternalComponent.prototype.isVisible = function () {
        return !this._rootElement.hidden;
    };
    /**
     * Sets the hidden attribute of the root element of the component to show it.
     * @returns {Boolean} Whether the component became visible as the result of this call
     */
    ExternalComponent.prototype.show = function () {
        if (this._rootElement) {
            if (!this.isVisible()) {
                this._rootElement.hidden = false;
                return true;
            }
        } else {
            application.log_DEBUG("WARNING! Attempting to show external component " + this._name + " before appending it to the page!");
        }
        return false;
    };
    /**
     * Sets the hidden attribute of the root element of the component to hide it.
     * @returns {Boolean} Whether the component became hidden as the result of this call
     */
    ExternalComponent.prototype.hide = function () {
        if (this._rootElement) {
            if (this.isVisible()) {
                this._rootElement.hidden = true;
                return true;
            }
        } else {
            application.log_DEBUG("WARNING! Attempting to hide external component " + this._name + " before appending it to the page!");
        }
        return false;
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
        this._status = this.registerSimpleComponent(LOADING_BOX_STATUS_DIV_ID);
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
            application.log_DEBUG("WARNING! Attempting to update the maximum progress value of loading box" + this._name + " before appending it to the page!");
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
            application.log_DEBUG("WARNING! Attempting to update the progress value of loading box" + this._name + " before appending it to the page!");
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
            application.log_DEBUG("WARNING! Attempting to update the status message of loading box" + this._name + " before appending it to the page!");
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
     * @param {String} [headerID] If given, the header element will get this ID
     * (prefixed with the component name), making it possible to auto-translate it
     * using the same string key as this ID
     * @param {String} [okButtonID] If given, the OK button element will get this ID
     * (prefixed with the component name), making it possible to auto-translate it
     * using the same string key as this ID
     * @param {Object.<String, Function>} [eventHandlers] The functions to execute when various events happen to this component.
     * Currently supported events: show, hide, buttonselect, buttonclick
     */
    function InfoBox(name, htmlFilename, style, headerID, okButtonID, eventHandlers) {
        ExternalComponent.call(this, name, htmlFilename, style);
        /**
         * A function that will be run every time the box is shown.
         * @type Function
         */
        this._onShow = eventHandlers ? eventHandlers[SHOW_EVENT_NAME] : null;
        /**
         * A function that will be run every time the box is hidden.
         * @type Function
         */
        this._onHide = eventHandlers ? eventHandlers[HIDE_EVENT_NAME] : null;
        /**
         * A function that will be run every time the OK button on the box is selected
         * @type Function
         */
        this._onButtonSelect = eventHandlers ? eventHandlers[BUTTON_SELECT_EVENT_NAME] : null;
        /**
         * A function that will be run every time the OK button on the box is clicked (/activated)
         */
        this._onButtonClick = eventHandlers ? eventHandlers[BUTTON_CLICK_EVENT_NAME] : null;
        /**
         * @type SimpleComponent
         */
        this._message = this.registerSimpleComponent(INFO_BOX_MESSAGE_PARAGRAPH_ID);
        /**
         * @type SimpleComponent
         */
        this._okButton = this.registerSimpleComponent(
                INFO_BOX_OK_BUTTON_ID,
                (this._onButtonSelect) ?
                {select: function () {
                        this._onButtonSelect(this._okButton.isEnabled());
                    }.bind(this)} :
                null);
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
         * A keyboard event handler that can be added to the document when the box is
         * shown to allow closing it by pressing enter, not just clicking on the button.
         * This needs to be a privileged method so that it can always access the 
         * original info box instance, no matter where is it called from.
         * @type Function
         * @param {KeyboardEvent} event
         */
        this._handleKeyUp = function (event) {
            if (event.keyCode === ENTER_CODE) {
                this._okButton.getElement().onclick();
            } else if ((event.keyCode === UP_CODE) || (event.keyCode === DOWN_CODE)) {
                this._okButton.select();
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
            this._okButton.getElement().onmouseenter = function () {
                this._okButton.select();
            }.bind(this);
            this._okButton.getElement().onmouseleave = function () {
                this._okButton.unselect();
            }.bind(this);
            this._okButton.getElement().onclick = function () {
                if (this._onButtonClick) {
                    this._onButtonClick(this._okButton.isEnabled());
                }
                this.hide();
                return false;
            }.bind(this);
            // at initialization, do not yet run the onHide function, since the box has
            // not been shown yet
            ExternalComponent.prototype.hide.call(this);
        }
    };
    /**
     * @override
     * @returns {Boolean}
     */
    InfoBox.prototype.show = function () {
        if (ExternalComponent.prototype.show.call(this)) {
            this._okButton.unselect();
            document.addEventListener("keyup", this._handleKeyUp);
            if (this._onShow) {
                this._onShow();
            }
            return true;
        }
        return false;
    };
    /**
     * @override
     * @returns {Boolean}
     */
    InfoBox.prototype.hide = function () {
        if (ExternalComponent.prototype.hide.call(this)) {
            document.removeEventListener("keyup", this._handleKeyUp);
            if (this._onHide) {
                this._onHide();
            }
            return true;
        }
        return false;
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
            application.log_DEBUG("WARNING! Attempting to update the message of info box" + this._name + " before appending it to the page!");
        }
    };
    // #########################################################################
    /**
     * @typedef {ExternalComponent~Style} MenuComponent~Style
     * @property {String} [menuClassName]
     * @property {String} [buttonClassName]
     * @property {String} [buttonContainerClassName]
     * @property {String} disabledClassName Added to disabled menu options. Disabled menu options cannot be selected
     * @property {String} selectedButtonClassName
     */
    /**
     * @typedef {Components~LabelDescriptor} MenuComponent~MenuOption
     * @property {String} [id] The key for translation
     * @property {String} [caption] Static caption (non-translated)
     * @property {Function} action The function to execute
     * @property {Boolean} [enabled=true] Only enabled options can be selected, and non-enabled options have a the disabled CSS class (defined in MenuComponent~Style)
     * @property {Element} [element] Set when the element is created
     */
    /**
     * @class A component that consists of a container and a list of menu options
     * inside, which execute given functions when clicked on
     * @extends ExternalComponent
     * @param {String} name See ExternalComponent.
     * @param {String} htmlFilename See ExternalComponent
     * @param {MenuComponent~Style} [style] See ExternalComponent
     * @param {MenuComponent~MenuOption[]} menuOptions An array of the available menu options
     * @param {Object.<String, Function>} [eventHandlers] The functions to execute when various events happen to this component.
     * Currently supported events: optionselect, optionclick
     */
    function MenuComponent(name, htmlFilename, style, menuOptions, eventHandlers) {
        var i;
        ExternalComponent.call(this, name, htmlFilename, style);
        /**
         * An array of the available menu options, each described by an object with 
         * a caption (String) and an action (Function) property.
         * @type MenuComponent~MenuOption[]
         */
        this._menuOptions = menuOptions;
        for (i = 0; i < this._menuOptions.length; i++) {
            if (this._menuOptions[i].enabled === undefined) {
                this._menuOptions[i].enabled = true;
            }
        }
        /**
         * The index of the currently selected menu option. -1 if no option is selected.
         * @type Number
         */
        this._selectedIndex = -1;
        /**
         * A function that runs whenever a menu option is selected.
         * @type Function
         */
        this._onOptionSelect = eventHandlers ? eventHandlers[OPTION_SELECT_EVENT_NAME] : null;
        /**
         * A function that runs whenever a menu option is clicked (/activated).
         * @type Function
         */
        this._onOptionClick = eventHandlers ? eventHandlers[OPTION_CLICK_EVENT_NAME] : null;
        // validate the style object as a missings selected style can lead to obscure bugs
        this._validateStyle(style);
    }
    MenuComponent.prototype = new ExternalComponent();
    MenuComponent.prototype.constructor = MenuComponent;
    /**
     * Shows an error message if the given style object is not valid.
     * @param {MenuComponent~Style} style
     */
    MenuComponent.prototype._validateStyle = function (style) {
        if (typeof style !== "object") {
            application.showError("Invalid menu style specified: not an object!");
            return;
        }
        if (!style.selectedButtonClassName) {
            application.showError("Attempting to specify a menu style without specifying a class for selected menu buttons!");
        }
        if (!style.disabledClassName) {
            application.showError("Attempting to specify a menu style without specifying a class for disabled menu buttons!");
        }
    };
    /**
     * Selects the option with the passed index (distinguishes the selected option with the set CSS class)
     * @param {Number} index
     */
    MenuComponent.prototype._selectIndex = function (index) {
        if (index !== this._selectedIndex) {
            if (this._selectedIndex >= 0) {
                this._menuOptions[this._selectedIndex].element.classList.remove(this._style.selectedButtonClassName);
                this._menuOptions[this._selectedIndex].element.blur();
            }
            this._selectedIndex = index;
            if (this._selectedIndex >= 0) {
                if (this._menuOptions[this._selectedIndex].enabled) {
                    this._menuOptions[this._selectedIndex].element.classList.add(this._style.selectedButtonClassName);
                    if (this._onOptionSelect) {
                        this._onOptionSelect(true); // always enabled - disabled menu options cannot be selected
                    }
                }
            }
        }
    };
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
    MenuComponent.prototype._getMenuClickHandler = function (index) {
        return function () {
            if (this._menuOptions[index].enabled) {
                this._selectIndex(index);
                this._menuOptions[index].action();
            }
            if (this._onOptionClick) {
                this._onOptionClick(this._menuOptions[index].enabled);
            }
            return false;
        }.bind(this);
    };
    /**
     * Returns an event listener that can be used for the element corresponding to the menu option with the
     * passed index to handle the mouse move events on it - selecting the option.
     * @param {Number} index
     * @returns {Function}
     */
    MenuComponent.prototype._getMenuMouseMoveHandler = function (index) {
        return function () {
            if (this._menuOptions[index].enabled) {
                this._selectIndex(index);
            }
        }.bind(this);
    };
    /**
     * Sets up the menu by appending the buttons to the container.
     */
    MenuComponent.prototype._initializeComponents = function () {
        var i, buttonElement, liElement;
        ExternalComponent.prototype._initializeComponents.call(this);
        if (this._rootElement) {
            this._rootElement.classList.add(this._style.menuClassName);
            for (i = 0; i < this._menuOptions.length; i++) {
                buttonElement = document.createElement("button");
                if (this._menuOptions[i].id) {
                    buttonElement.id = this._getElementID(this._menuOptions[i].id);
                    buttonElement.setAttribute(TRANSLATION_KEY_ATTRIBUTE, this._menuOptions[i].id);
                }
                buttonElement.className = (this._style.menuClassName || "") + " " + (this._style.buttonClassName || "") + (this._menuOptions[i].enabled ? "" : this._style.disabledClassName);
                buttonElement.innerHTML = _getLabelText(this._menuOptions[i]);
                // we need to generate an appropriate handler function here for each
                // menu element (cannot directly create it here as they would all use
                // the same index as i would be a closure)
                buttonElement.onclick = this._getMenuClickHandler(i);
                buttonElement.onmousemove = this._getMenuMouseMoveHandler(i);
                this._menuOptions[i].element = buttonElement;
                liElement = document.createElement("li");
                liElement.className = (this._style.buttonContainerClassName || "");
                liElement.appendChild(buttonElement);
                this._rootElement.appendChild(liElement);
            }
            this._rootElement.onmouseout = this.unselect.bind(this);
        }
    };
    /**
     * Cancels the selection of the currently selected menu item (if any)
     */
    MenuComponent.prototype.unselect = function () {
        this._selectIndex(-1);
    };
    /**
     * Selects the menu item coming after the currently selected one, or the first one if none are selected. Skips disabled options.
     */
    MenuComponent.prototype.selectNext = function () {
        var start = this._selectedIndex;
        if (start === -1) {
            start = this._menuOptions.length - 1;
        }
        do {
            this._selectIndex((this._selectedIndex + 1) % this._menuOptions.length);
        } while (this._selectedIndex !== start && !this._menuOptions[this._selectedIndex].enabled);
        if (!this._menuOptions[this._selectedIndex].enabled) {
            this._selectIndex(-1);
        }
    };
    /**
     * Selects the menu item coming before the currently selected one, or the last one if none are selected. Skips disabled options.
     */
    MenuComponent.prototype.selectPrevious = function () {
        var start = this._selectedIndex;
        if (start === -1) {
            start = 0;
        }
        do {
            if (this._selectedIndex > 0) {
                this._selectIndex(this._selectedIndex - 1);
            } else {
                this._selectIndex(this._menuOptions.length - 1);
            }
        } while (this._selectedIndex !== start && !this._menuOptions[this._selectedIndex].enabled);
        if (!this._menuOptions[this._selectedIndex].enabled) {
            this._selectIndex(-1);
        }
    };
    /**
     * Executes the action associated with the currently selected menu option (if any).
     */
    MenuComponent.prototype.activateSelected = function () {
        if (this._selectedIndex >= 0) {
            this._menuOptions[this._selectedIndex].element.onclick();
        }
    };
    // #########################################################################
    /**
     * @typedef {ExternalComponent~Style} ListComponent~Style
     * @property {String} [listClassName]
     * @property {String} [listContainerClassName]
     * @property {String} [elementClassName]
     * @property {String} [elementContainerClassName]
     * @property {String} [captionClassName]
     * @property {String} [subcaptionClassName]
     * @property {String} disabledElementClassName Added to disabled list elements. Disabled list elements cannot be highlighted or selected
     * @property {String} selectedElementClassName
     * @property {String} highlightedElementClassName
     */
    /**
     * @typedef {Object} ListComponent~ListElement
     * @property {String} [captionID] The key for translation for the main caption
     * @property {String} [caption] Main static caption (non-translated)
     * @property {String} [subcaptionID] The key for translation for the subcaption
     * @property {String} [subcaption] Static subcaption (non-translated)
     * @property {Boolean} [enabled=true] Only enabled list elements can be selected, and non-enabled elements have a the disabled CSS class (defined in ListComponent~Style)
     * @property {Element} [element] Set when the element is created
     */
    /**
     * @class A component that consists of a container and a list of selectable elements. Elements can be highlighted, which represents a 
     * transient state and then the highlighted element can be selected (cancelling previous selections - only one element can be highlighted
     * or selected at a time) - selection is a persistent state
     * @extends ExternalComponent
     * @param {String} name See ExternalComponent.
     * @param {String} htmlFilename See ExternalComponent
     * @param {ListComponent~Style} [style] See ExternalComponent
     * @param {ListComponent~ListElement[]} listElements An array of the available list elements
     * @param {Boolean} subcaptions Whether to display the subcaptions of the list element
     * @param {Object.<String, Function>} [eventHandlers] The functions to execute when various events happen to this component.
     * Currently supported events: elementhighlight, elementselect
     */
    function ListComponent(name, htmlFilename, style, listElements, subcaptions, eventHandlers) {
        var i;
        ExternalComponent.call(this, name, htmlFilename, style);
        /**
         * An array of the available list elements, each described by a ListComponent~ListElement object
         * @type ListComponent~ListElement[]
         */
        this._listElements = listElements;
        for (i = 0; i < this._listElements.length; i++) {
            if (this._listElements[i].enabled === undefined) {
                this._listElements[i].enabled = true;
            }
        }
        /**
         * Whether to display the subcaptions of the list element
         * @type Boolean
         */
        this._subcaptions = subcaptions;
        /**
         * The index of the highlighted list element. -1 if no element is highlighted.
         * @type Number
         */
        this._highlightedIndex = -1;
        /**
         * The index of the selected list element. -1 if no element is selected.
         * @type Number
         */
        this._selectedIndex = -1;
        /**
         * A function that runs whenever an element is highlighted
         * @type Function
         */
        this._onElementHighlight = eventHandlers ? eventHandlers[ELEMENT_HIGHLIGHT_EVENT_NAME] : null;
        /**
         * A function that runs whenever an element is selected
         * @type Function
         */
        this._onElementSelect = eventHandlers ? eventHandlers[ELEMENT_SELECT_EVENT_NAME] : null;
        /**
         * The ul tag housing the list elements
         * @type Element
         */
        this._ulElement = null;
        // validate the style object as a missings highlighted style can lead to obscure bugs
        this._validateStyle(style);
    }
    ListComponent.prototype = new ExternalComponent();
    ListComponent.prototype.constructor = ListComponent;
    /**
     * Shows an error message if the given style object is not valid.
     * @param {ListComponent~Style} style
     */
    ListComponent.prototype._validateStyle = function (style) {
        if (typeof style !== "object") {
            application.showError("Invalid menu style specified: not an object!");
            return;
        }
        if (!style.disabledElementClassName) {
            application.showError("Attempting to specify a list style without specifying a class for disabled list elements!");
        }
        if (!style.selectedElementClassName) {
            application.showError("Attempting to specify a list style without specifying a class for selected list elements!");
        }
        if (!style.highlightedElementClassName) {
            application.showError("Attempting to specify a list style without specifying a class for highlighted list elements!");
        }
    };
    /**
     * Make sure the element with the passed index is visible by scrolling if necessary 
     * @param {Number} index
     */
    ListComponent.prototype._scrollToIndex = function (index) {
        var listElement;
        listElement = this._listElements[index].element;
        if (listElement.offsetTop < this._rootElement.scrollTop) {
            this._rootElement.scrollTop = listElement.offsetTop;
        } else if (listElement.offsetTop + listElement.offsetHeight > this._rootElement.scrollTop + this._rootElement.clientHeight) {
            this._rootElement.scrollTop = listElement.offsetTop + listElement.offsetHeight - this._rootElement.clientHeight;
        }
    };
    /**
     * Highlights the element with the passed index (distinguishes the highlighted option with the set CSS class)
     * @param {Number} index Index of the element (-1 to cancel current highlight)
     * @param {Boolean} [scroll=false] Whether to make sure the highlighted element is visible by scrolling if necessary (to be used with 
     * keyboard controls)
     */
    ListComponent.prototype._highlightIndex = function (index, scroll) {
        if (index !== this._highlightedIndex) {
            if (this._highlightedIndex >= 0) {
                this._listElements[this._highlightedIndex].element.classList.remove(this._style.highlightedElementClassName);
            }
            this._highlightedIndex = index;
            if (this._highlightedIndex >= 0) {
                if (this._listElements[this._highlightedIndex].enabled) {
                    this._listElements[this._highlightedIndex].element.classList.add(this._style.highlightedElementClassName);
                    if (scroll) {
                        this._scrollToIndex(index);
                    }
                    if (this._onElementHighlight) {
                        this._onElementHighlight(index, true); // always enabled - disabled list elements cannot be highlighted
                    }
                }
            }
        }
    };
    /**
     * Selects the element with the passed index (distinguishes the selected option with the set CSS class)
     * @param {Number} index Index of the element (-1 to cancel selection)
     * @param {Boolean} [scroll=false] Whether to make sure the selected element is visible by scrolling if necessary
     */
    ListComponent.prototype.selectIndex = function (index, scroll) {
        if (scroll && (index >= 0)) {
            this._scrollToIndex(index);
        }
        if (index !== this._selectedIndex) {
            if ((index < 0) || ((index >= 0) && this._listElements[index].enabled)) {
                if (this._selectedIndex >= 0) {
                    this._listElements[this._selectedIndex].element.classList.remove(this._style.selectedElementClassName);
                }
                this._selectedIndex = index;
                if (this._selectedIndex >= 0) {
                    this._listElements[this._selectedIndex].element.classList.add(this._style.selectedElementClassName);
                }
            }
            if (this._onElementSelect) {
                this._onElementSelect(index, (index >= 0) && this._listElements[index].enabled);
            }
        }
    };
    /**
     * Returns the index of the currently highlighted element (-1 if no element is currently highlighted)
     * @returns {Number}
     */
    ListComponent.prototype.getHighlightedIndex = function () {
        return this._highlightedIndex;
    };
    /**
     * Returns the index of the currently selected element (-1 if no element is currently selected)
     * @returns {Number}
     */
    ListComponent.prototype.getSelectedIndex = function () {
        return this._selectedIndex;
    };
    /**
     * The return value of the click handler on a link decides whether the link path 
     * should be followed or not. By making sure it is false, the links will not bring 
     * the user back to the top of the page (because href is #). 
     * @param {Number} index
     * @returns {Function}
     */
    ListComponent.prototype._getElementClickHandler = function (index) {
        return function () {
            if (this._listElements[index].enabled) {
                this.selectIndex(index);
            }
            return false;
        }.bind(this);
    };
    /**
     * Returns an event listener that can be used for the HTML element corresponding to the list element with the
     * passed index to handle the mouse move events on it - highlighting the option. (without scrolling)
     * @param {Number} index
     * @returns {Function}
     */
    ListComponent.prototype._getElementMouseMoveHandler = function (index) {
        return function () {
            if (this._listElements[index].enabled) {
                this._highlightIndex(index);
            } else {
                this._highlightIndex(-1);
            }
        }.bind(this);
    };
    /**
     * @param {ListComponent~ListElement} listElement
     * @param {Number} index
     */
    ListComponent.prototype._addListElement = function (listElement, index) {
        var spanElement, aElement, liElement;
        // element container
        liElement = document.createElement("li");
        liElement.className = (this._style.elementContainerClassName || "");
        // element 
        aElement = document.createElement("a");
        aElement.className = (this._style.elementClassName || "") + " " + (listElement.enabled ? "" : this._style.disabledElementClassName);
        listElement.element = aElement;
        aElement.onclick = this._getElementClickHandler(index);
        aElement.onmousemove = this._getElementMouseMoveHandler(index);
        liElement.appendChild(aElement);
        // main caption
        spanElement = document.createElement("span");
        if (listElement.captionID) {
            spanElement.setAttribute(TRANSLATION_KEY_ATTRIBUTE, listElement.captionID);
        }
        spanElement.className = (this._style.captionClassName || "");
        spanElement.innerHTML = listElement.caption || strings.get({name: listElement.captionID});
        aElement.appendChild(spanElement);
        if (this._subcaptions) {
            // dividing captions
            aElement.appendChild(document.createElement("br"));
            // subcaption
            spanElement = document.createElement("span");
            if (listElement.subcaptionID) {
                spanElement.setAttribute(TRANSLATION_KEY_ATTRIBUTE, listElement.subcaptionID);
            }
            spanElement.className = (this._style.subcaptionClassName || "");
            spanElement.innerHTML = listElement.subcaption || strings.get({name: listElement.subcaptionID});
            aElement.appendChild(spanElement);
        }
        // adding to DOM hierarchy
        this._ulElement.appendChild(liElement);
    };
    /**
     * Add a new list element after the last one
     * @param {ListComponent~ListElement} listElement
     */
    ListComponent.prototype.addListElement = function (listElement) {
        if (listElement.enabled === undefined) {
            listElement.enabled = true;
        }
        this._listElements.push(listElement);
        this._addListElement(listElement, this._listElements.length - 1);
    };
    /**
     * @override
     */
    ListComponent.prototype._initializeComponents = function () {
        var i;
        ExternalComponent.prototype._initializeComponents.call(this);
        if (this._rootElement) {
            // list container
            this._rootElement.classList.add(this._style.listContainerClassName);
            // list
            this._ulElement = document.createElement("ul");
            this._ulElement.classList.add(this._style.listClassName);
            for (i = 0; i < this._listElements.length; i++) {
                this._addListElement(this._listElements[i], i);
            }
            this._rootElement.onmouseleave = this.unhighlight.bind(this);
            this._rootElement.appendChild(this._ulElement);
        }
    };
    /**
     * Cancels the highlight of the currently highlighted list element (if any)
     */
    ListComponent.prototype.unhighlight = function () {
        this._highlightIndex(-1);
    };
    /**
     * Cancels the selection of the currently selected list element (if any)
     */
    ListComponent.prototype.unselect = function () {
        this.selectIndex(-1);
    };
    /**
     * Cancels the highlight and selection and scrolls to the top of the list
     */
    ListComponent.prototype.reset = function () {
        this.unselect();
        this.unhighlight();
        this._rootElement.scrollTop = 0;
    };
    /**
     * Highlights the list element coming after the currently highlighted one, or the first one if none are highlighted. Skips disabled elements.
     */
    ListComponent.prototype.highlightNext = function () {
        var start = this._highlightedIndex;
        if (start === -1) {
            start = this._listElements.length - 1;
        }
        do {
            this._highlightIndex((this._highlightedIndex + 1) % this._listElements.length, true);
        } while (this._highlightedIndex !== start && !this._listElements[this._highlightedIndex].enabled);
        if (!this._listElements[this._highlightedIndex].enabled) {
            this._highlightIndex(-1);
        }
    };
    /**
     * Highlights the list element coming before the currently highlighted one, or the last one if none are highlighted. Skips disabled elements.
     */
    ListComponent.prototype.highlightPrevious = function () {
        var start = this._highlightedIndex;
        if (start === -1) {
            start = 0;
        }
        do {
            if (this._highlightedIndex > 0) {
                this._highlightIndex(this._highlightedIndex - 1, true);
            } else {
                this._highlightIndex(this._listElements.length - 1, true);
            }
        } while (this._highlightedIndex !== start && !this._listElements[this._highlightedIndex].enabled);
        if (!this._listElements[this._highlightedIndex].enabled) {
            this._highlightIndex(-1);
        }
    };
    /**
     * Selects the currently highlighted list element (executing the handler if set)
     */
    ListComponent.prototype.selectHighlighted = function () {
        if (this._highlightedIndex >= 0) {
            this._listElements[this._highlightedIndex].element.onclick();
        }
    };
    /**
     * Executes the passed callback function for each list element, passing the HTML element representing that list element as its single
     * argument
     * @param {Function} callback 
     */
    ListComponent.prototype.executeForListElements = function (callback) {
        var i;
        for (i = 0; i < this._listElements.length; i++) {
            callback(this._listElements[i].element);
        }
    };
    /**
     * Set the caption of a list element directly (removing any translation keys)
     * @param {Number} index
     * @param {String} caption
     */
    ListComponent.prototype.setCaption = function (index, caption) {
        var listElement = this._listElements[index], spanElement = listElement.element.querySelector("." + this._style.captionClassName);
        if (listElement.captionID) {
            listElement.captionID = "";
            spanElement.setAttribute(TRANSLATION_KEY_ATTRIBUTE, "");
        }
        listElement.caption = caption;
        spanElement.innerHTML = caption;
    };
    // #########################################################################
    /**
     * @typedef {ExternalComponent~Style} Selector~Style
     * @property {String} [selectorClassName] The root element of the Selector will have this CSS class
     * @property {String} [propertyContainerClassName] The element containing the property name label will have this CSS class
     */
    /**
     * @class A component that consists of a label describing a property, and a
     * button that can be clicked to select from a list of possible values for that
     * property. (suitable for properties with a small amount of possible values, 
     * as each click will show the next value, and when the last is reached, the 
     * cycle will begin again)
     * @extends ExternalComponent
     * @param {String} name See ExternalComponent.
     * @param {String} htmlFilename See ExternalComponent.
     * @param {Selector~Style} [style] See ExternalComponent.
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
            if (this._style.selectorClassName) {
                this._rootElement.className = this._style.selectorClassName;
            }
            if (this._propertyLabelDescriptor.id) {
                this._propertyLabel.setElementID(this._getElementID(this._propertyLabelDescriptor.id));
                this._propertyLabel.getElement().setAttribute(TRANSLATION_KEY_ATTRIBUTE, this._propertyLabelDescriptor.id);
            }
            this._propertyLabel.setContent(_getLabelText(this._propertyLabelDescriptor));
            if (this._style.propertyContainerClassName) {
                this._propertyLabel.getElement().className = this._style.propertyContainerClassName;
            }
            this._valueSelector.setContent(this._valueList[0]);
            this._valueIndex = 0;
            this.setValueList(this._valueList);
            this._valueSelector.getElement().onmouseup = function (event) {
                event.preventDefault();
                event.stopPropagation();
                switch (event.which) {
                    case 1:
                        this.selectNextValue();
                        break;
                    case 3:
                        this.selectPreviousValue();
                        break;
                }
                return false;
            }.bind(this);
            this._valueSelector.getElement().oncontextmenu = function (event) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            };
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
                this.selectValueWithIndex(i, 0);
            } else {
                application.showError(
                        "Attempted to select value: '" + value + "' for '" + _getLabelText(this._propertyLabelDescriptor) + "', which is not one of the available options.",
                        application.ErrorSeverity.MINOR);
            }
        } else {
            application.showError("Attemted to select value for selector " + this._name + " which is not yet appended to the page!");
        }
    };
    /**
     * Selects the value with the passed index from the list.
     * @param {Number} index
     * @param {Number} [stepping=0] If the value was changed by stepping through the value list (clicking on the selector),
     * should be 1 for stepping up (forward), -1 for stepping down (backward) and 0 otherwise. The value of this is passed
     * to the onChange() handler.
     */
    Selector.prototype.selectValueWithIndex = function (index, stepping) {
        var originalIndex = this._valueIndex;
        if (this._rootElement) {
            if (this._valueList.length > index) {
                this._valueIndex = index;
                this._valueSelector.setContent(this._valueList[this._valueIndex]);
                if ((originalIndex !== index) && this.onChange) {
                    this.onChange(stepping || 0);
                }
            } else {
                application.showError(
                        "Attempted to select value with index '" + index + "' for '" + _getLabelText(this._propertyLabelDescriptor) + "', while the available range is: 0-" + (this._valueList.length - 1),
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
        this.selectValueWithIndex((this._valueIndex + 1) % this._valueList.length, 1);
    };
    /**
     * Selects the previous available value from the list. If the first value was selected,
     * selects the last one.
     */
    Selector.prototype.selectPreviousValue = function () {
        this.selectValueWithIndex((this._valueIndex > 0) ? this._valueIndex - 1 : this._valueList.length - 1, -1);
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
        if (this._valueList.length < 2) {
            this._valueSelector.disable();
        } else {
            this._valueSelector.enable();
        }
    };
    // #########################################################################
    /**
     * @typedef {Object} Slider~Params
     * @property {Number} min
     * @property {Number} max
     * @property {Number} default
     * @property {Number} [step]
     * @property {String[]} [valueList] If given, the slider will have as many possible values as the number of these options, and a label
     * will be displayed next to the slider, showing the currently selected item from this list
     */
    /**
     * @class A component that consists of a label describing a property, and a slider that can be used to select from a range of possible 
     * numeric values for that property.
     * @extends ExternalComponent
     * @param {String} name See ExternalComponent.
     * @param {String} htmlFilename See ExternalComponent.
     * @param {ExternalComponent~Style} [style] See ExternalComponent.
     * @param {Components~LabelDescriptor} propertyLabelDescriptor The caption and id of the property label element that is displayed on this
     * selector, indicating what property can be set with it
     * @param {Slider~Params} params
     * @param {Function} [onChange]
     */
    function Slider(name, htmlFilename, style, propertyLabelDescriptor, params, onChange) {
        ExternalComponent.call(this, name, htmlFilename, style);
        /**
         * The name of the property that can be set using this selector.
         * @type Components~LabelDescriptor
         */
        this._propertyLabelDescriptor = propertyLabelDescriptor;
        params = params || {};
        /**
         * The minimum value on the slider
         * @type Number
         */
        this._min = params.valueList ? 0 : params.min;
        /**
         * The maximum value on the slider
         * @type Number
         */
        this._max = params.valueList ? (params.valueList.length - 1) : params.max;
        /**
         * The starting value on the slider
         * @type Number
         */
        this._default = params.default;
        /**
         * The difference between two adjacent possible values of the slider
         * @type Number
         */
        this._step = params.valueList ? 1 : ((params.step !== undefined) ? params.step : 1);
        /**
         * The list of possible values, in case the slider is used to select from them
         * @type String[]
         */
        this._valueList = params.valueList || null;
        /**
         * A wrapper for the HTML element containing the label caption for the property
         * this selector sets.
         * @type SimpleComponent
         */
        this._propertyLabel = this.registerSimpleComponent(SLIDER_PROPERTY_LABEL_ID);
        /**
         * A wrapper for the HTML element corresponding to the slider itself (an "input" of type "range")
         * @type SimpleComponent
         */
        this._slider = this.registerSimpleComponent(SLIDER_ID);
        /**
         * A wrapper for the HTML element which serves as the label of the currently selected value (in case a value list is given)
         * @type SimpleComponent
         */
        this._valueLabel = this.registerSimpleComponent(SLIDER_VALUE_LABEL_ID);
        /**
         * A function to execute when the selected value has been changed.
         * @type Function
         */
        this.onChange = onChange || null;
    }
    Slider.prototype = new ExternalComponent();
    Slider.prototype.constructor = Slider;
    /**
     * Initializes the components, sets their text and sets the handler for the click on the selector.
     */
    Slider.prototype._initializeComponents = function () {
        var changeHandler = function () {
            this._updateValueLabel();
            if (this.onChange) {
                this.onChange(this.getValue());
            }
        }.bind(this);
        ExternalComponent.prototype._initializeComponents.call(this);
        if (this._rootElement) {
            if (this._propertyLabelDescriptor.id) {
                this._propertyLabel.setElementID(this._getElementID(this._propertyLabelDescriptor.id));
                this._propertyLabel.getElement().setAttribute(TRANSLATION_KEY_ATTRIBUTE, this._propertyLabelDescriptor.id);
            }
            this._propertyLabel.setContent(_getLabelText(this._propertyLabelDescriptor));

            if (this._valueList) {
                this.setValueList(this._valueList);
                this._valueLabel.show();
            } else {
                this._valueLabel.hide();
                this._updateSlider();
            }

            this.setNumericValue(this._default);

            this._slider.getElement().onchange = changeHandler;
            this._slider.getElement().oninput = changeHandler;
        }
    };
    /**
     * Updated the attributes of the slider HTML element based on the properties of this object
     */
    Slider.prototype._updateSlider = function () {
        this._slider.setAttribute("min", this._min);
        this._slider.setAttribute("max", this._max);
        this._slider.setAttribute("step", this._step);
    };
    /**
     * Updates the content of the value label to show the currently selected value (if a value list is given)
     */
    Slider.prototype._updateValueLabel = function () {
        if (this._valueList) {
            this._valueLabel.setContent(this._valueList[this.getNumericValue()]);
        }
    };
    /**
     * Directly sets a new numeric value for the slider
     * @param {Number} value
     */
    Slider.prototype.setNumericValue = function (value) {
        this._slider.setAttribute("value", value);
        this._updateValueLabel();
    };
    /**
     * Sets a new value for the slider based on the given string, which should be one of the values given as a value list
     * @param {String} value
     */
    Slider.prototype.setListedValue = function (value) {
        var index;
        if (this._valueList) {
            index = this._valueIndex.indexOf(value);
            if (index >= 0) {
                this.setNumericValue(index);
            } else {
                application.showError("Cannot set listed value '" + value + "' for slider '" + this.getName() + "', because it is not in the value list!");
            }
        } else {
            application.showError("Cannot set listed value '" + value + "' for slider '" + this.getName() + "', because it has no value list!");
        }
    };
    /**
     * Returns the value currently selected on the slider
     * @returns {Number} 
     */
    Slider.prototype.getNumericValue = function () {
        return parseFloat(this._slider.getAttribute("value"));
    };
    /**
     * Returns the value from the value list given (which needs to be initialized!) based on the current value of the slider
     * @returns {String} 
     */
    Slider.prototype.getListedValue = function () {
        return this._valueList[this.getNumericValue()];
    };
    /**
     * Returns either the numeric (if there is no value list) or the listed (if there is one) value of the slider component
     * @returns {Number|String}
     */
    Slider.prototype.getValue = function () {
        return this._valueList ? this.getListedValue() : this.getNumericValue();
    };
    /**
     * Sets a new value list to be used for this component - that is, the possible slider values will represent the items of this list in 
     * order, and the current item will be displayed on the component
     * @param {String[]} valueList
     */
    Slider.prototype.setValueList = function (valueList) {
        var value = this.getNumericValue();
        this._valueList = valueList;
        this._min = 0;
        this._max = valueList.length - 1;
        this._step = 1;
        if (value > this._max) {
            value = 0;
        }
        this._updateSlider();
        this.setNumericValue(value);
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ELEMENT_ID_SEPARATOR: ELEMENT_ID_SEPARATOR,
        // class names
        DISABLED_CLASS_NAME: DISABLED_CLASS_NAME,
        SELECTED_CLASS_NAME: SELECTED_CLASS_NAME,
        HIGHLIGHTED_CLASS_NAME: HIGHLIGHTED_CLASS_NAME,
        // event names
        SHOW_EVENT_NAME: SHOW_EVENT_NAME,
        HIDE_EVENT_NAME: HIDE_EVENT_NAME,
        BUTTON_SELECT_EVENT_NAME: BUTTON_SELECT_EVENT_NAME,
        BUTTON_CLICK_EVENT_NAME: BUTTON_CLICK_EVENT_NAME,
        OPTION_SELECT_EVENT_NAME: OPTION_SELECT_EVENT_NAME,
        OPTION_CLICK_EVENT_NAME: OPTION_CLICK_EVENT_NAME,
        // attribute names
        TRANSLATION_KEY_ATTRIBUTE: TRANSLATION_KEY_ATTRIBUTE,
        // functions
        clearStoredDOMModels: clearStoredDOMModels,
        // classes
        SimpleComponent: SimpleComponent,
        LoadingBox: LoadingBox,
        InfoBox: InfoBox,
        MenuComponent: MenuComponent,
        ListComponent: ListComponent,
        Selector: Selector,
        Slider: Slider
    };
});