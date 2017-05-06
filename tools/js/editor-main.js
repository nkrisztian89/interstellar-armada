/**
 * Copyright 2016-2017 Krisztián Nagy
 * @file The entry point for the Interstellar Armada editor, to be invoked by RequireJS.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global requirejs */
/**
 * @param editor
 */
requirejs(["editor/editor"], function (editor) {
    "use strict";
    editor.initialize({electron: false});
});
