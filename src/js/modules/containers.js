/**
 * Copyright 2017 Krisztián Nagy
 * @file Provides container classes for general use.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, Float32Array, performance */

define(function () {
    "use strict";
    /**
     * @typedef {Object} DirectDoubleLinkedList~Element
     * @property {DirectDoubleLinkedList~Element} next A reference to the next list element.
     * @property {DirectDoubleLinkedList~Element} previous A reference to the previous list element.
     * @property {DirectDoubleLinkedList} list A reference to the linked list which this element is part of.
     */
    /**
     * @class A linked list class that is
     * - direct: to be used with elements that directly hold the linked list-related properties. One element can only be part of one linked
     * list. Element properties must not clash with the linked list properties.
     * - double-linked: links to both next and previous elements are available
     */
    function DirectDoubleLinkedList() {
        /**
         * The first element of the list.
         * @type DirectDoubleLinkedList~Element
         */
        this._first = null;
        /**
         * The last element of the list.
         * @type DirectDoubleLinkedList~Element
         */
        this._last = null;
        /**
         * The number of elements the list currently holds.
         * @type Number
         */
        this._length = 0;
    }
    /**
     * Appends the passed element to the end of the list.
     * @param {DirectDoubleLinkedList~Element} element
     */
    DirectDoubleLinkedList.prototype.add = function (element) {
        if (!this._first) {
            this._first = element;
            element.previous = null;
        } else {
            this._last.next = element;
            element.previous = this._last;
        }
        element.next = null;
        element.list = this;
        this._last = element;
        this._length++;
    };
    /**
     * Removes the passed element if it is contained in the list.
     * @param {DirectDoubleLinkedList~Element} element
     */
    DirectDoubleLinkedList.prototype.remove = function (element) {
        if (element.list === this) {
            if (element.previous) {
                element.previous.next = element.next;
            } else {
                this._first = element.next;
            }
            if (element.next) {
                element.next.previous = element.previous;
            } else {
                this._last = element.previous;
            }
            element.list = null;
            this._length--;
        }
    };
    /**
     * Removes all elements from the list.
     * @param {Boolean} [hard=false] If true, also removes the reference to this list stored in the elements.
     */
    DirectDoubleLinkedList.prototype.clear = function (hard) {
        var element;
        if (hard) {
            for (element = this._first; element; element = element.next) {
                element.list = null;
            }
        }
        this._first = null;
        this._last = null;
        this._length = 0;
    };
    /**
     * Returns the number of elements that are currently in the list.
     * @returns {Number}
     */
    DirectDoubleLinkedList.prototype.getLength = function () {
        return this._length;
    };
    /**
     * Returns the first element of the list.
     * @returns {DirectDoubleLinkedList~Element}
     */
    DirectDoubleLinkedList.prototype.getFirst = function () {
        return this._first;
    };
    /**
     * Returns the last element of the list.
     * @returns {DirectDoubleLinkedList~Element}
     */
    DirectDoubleLinkedList.prototype.getLast = function () {
        return this._last;
    };
    /**
     * Returns the element coming after the passed element in the list, or the first element, if the passed element is the last element in
     * the list, it is not in the list or it is not given.
     * @param {DirectDoubleLinkedList~Element} [element]
     */
    DirectDoubleLinkedList.prototype.getNext = function (element) {
        if (element && (element.list === this)) {
            return element.next || this._first;
        }
        return this._first;
    };
    /**
     * Returns the element coming before the passed element in the list, or the last element, if the passed element is the first element in
     * the list, it is not in the list or it is not given.
     * @param {DirectDoubleLinkedList~Element} [element]
     */
    DirectDoubleLinkedList.prototype.getPrevious = function (element) {
        if (element && (element.list === this)) {
            return element.previous || this._last;
        }
        return this._last;
    };
    /**
     * Appends the elements of this linked list to the end of the passed regular JS array.
     * @param {Array} array
     */
    DirectDoubleLinkedList.prototype.appendToArray = function (array) {
        var element, i;
        i = array.length;
        array.length = i + this._length;
        for (element = this._first; element; element = element.next, i++) {
            array[i] = element;
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        DirectDoubleLinkedList: DirectDoubleLinkedList
    };
});