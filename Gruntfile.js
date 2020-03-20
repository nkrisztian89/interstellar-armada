/*jslint white: true*/
/*global module*/
module.exports = function (grunt) {
    "use strict";
    var scssMappings = {
        "css/general.css": 'scss/general.scss',
        "css/about.css": 'scss/screens/about.scss',
        "css/battle.css": 'scss/screens/battle.scss',
        "css/controls.css": 'scss/screens/controls.scss',
        "css/database.css": 'scss/screens/database.scss',
        "css/debriefing.css": 'scss/screens/debriefing.scss',
        "css/gameplay-settings.css": 'scss/screens/gameplay-settings.scss',
        "css/graphics.css": 'scss/screens/graphics.scss',
        "css/ingame-menu.css": 'scss/screens/ingame-menu.scss',
        "css/missions.css": 'scss/screens/missions.scss',
        "css/dialog.css": 'scss/components/dialog.scss',
        "css/infobox.css": 'scss/components/infobox.scss',
        "css/listcomponent.css": 'scss/components/listcomponent.scss',
        "css/loadingbox.css": 'scss/components/loadingbox.scss',
        "css/selector.css": 'scss/components/selector.scss',
        "css/slider.css": 'scss/components/slider.scss',
        "css/editor.css": 'tools/scss/editor.scss'
    };
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        _requirejs: {
            compile: {
                options: {
                    baseUrl: "js",
                    name: "main",
                    optimize: "uglify2",
                    uglify2: {
                        mangle: {
                            keep_fnames: false // turn on to keep minification but make error messages using constructor.name readable
                        }
                    },
                    out: "js/main-optimized.js",
                    preserveLicenseComments: false
                }
            }
        },
        _clean: {
            dev: ["js/main-optimized.js", "css/*"]
        },
        _eslint: {
            options: {
                configFile: ".eslintrc.js"
            },
            target: ["js/"]
        },
        _sass: {
            dev: {
                options: {
                    style: "expanded"
                },
                files: scssMappings
            },
            dist: {
                options: {
                    noSourceMap: true,
                    style: "compressed"
                },
                files: scssMappings
            }
        },
        _minify: {
            dist: {
                files: 'data/**/*.json'
            }
        },
        _replace: {
            dist: {
                options: {
                    patterns: [
                        {
                            match: 'main.js',
                            replacement: 'main-optimized.js'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['index.html'], dest: './'}
                ]
            },
            preOptimize: {
                options: {
                    patterns: [
                        {
                            match: '_matrixCount++;',
                            replacement: '//_matrixCount++;'
                        }, {
                            match: 'application.log_DEBUG',
                            replacement: '//application.log_DEBUG'
                        }, {
                            match: '_DEBUG_STATS.',
                            replacement: '//_DEBUG_STATS.'
                        }, {
                            match: 'egomModel.resetDebugStats();',
                            replacement: '//egomModel.resetDebugStats();'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['js/utils/matrices.js'], dest: 'js/utils/'},
                    {expand: true, flatten: true, src: ['js/modules/egom-model.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/scene/scene-graph.js'], dest: 'js/modules/scene/'},
                    {expand: true, flatten: true, src: ['js/modules/scene/renderable-objects.js'], dest: 'js/modules/scene/'},
                    {expand: true, flatten: true, src: ['js/modules/managed-gl.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/resource-manager.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/media-resources.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/control.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/armada/graphics.js'], dest: 'js/armada/'},
                    {expand: true, flatten: true, src: ['js/armada/logic/equipment.js'], dest: 'js/armada/logic/'},
                    {expand: true, flatten: true, src: ['js/armada/logic/spacecraft.js'], dest: 'js/armada/logic/'}
                ]
            },
            // replacing some widely and frequently used one-line getter calls with the direct access of their respective properties to
            // avoid the overhead of calling the getter functions
            optimize: {
                options: {
                    patterns: [
                        {
                            match: '.getPositionMatrix()',
                            replacement: '._positionMatrix'
                        }, {
                            match: '.getOrientationMatrix()',
                            replacement: '._orientationMatrix'
                        }, {
                            match: '.getScalingMatrix()',
                            replacement: '._scalingMatrix'
                        }, {
                            match: '.getParent()',
                            replacement: '._parent'
                        }, {
                            match: '.getScene()',
                            replacement: '._scene'
                        }, {
                            match: '.getRenderableObject()',
                            replacement: '._renderableObject'
                        }, {
                            match: '.getSubnodes()',
                            replacement: '._subnodes'
                        }, {
                            match: '.getMinimumCountForInstancing()',
                            replacement: '._minimumCountForInstancing'
                        }, {
                            match: '.getRootNode()',
                            replacement: '._rootNode'
                        }, {
                            match: '.getCamera()',
                            replacement: '._camera'
                        }, {
                            match: '_scene.getLODContext()',
                            replacement: '_scene._lodContext'
                        }, {
                            match: '.getStates()',
                            replacement: '._states'
                        }, {
                            match: '.getDuration()',
                            replacement: '._duration'
                        }, {
                            match: '.getVisualModel()',
                            replacement: '._visualModel'
                        }, {
                            match: '.getPhysicalModel()',
                            replacement: '._physicalModel'
                        }, {
                            match: '.childrenAlwaysInside()',
                            replacement: '._childrenAlwaysInside'
                        }, {
                            match: '.shouldIgnoreTransform()',
                            replacement: '._ignoreTransform'
                        }, {
                            match: 'setFileCacheBypassEnabled(!0)',
                            replacement: 'setFileCacheBypassEnabled(0)'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['js/main-optimized.js'], dest: 'js/'}
                ]
            },
            postOptimize: {
                options: {
                    patterns: [
                        {
                            match: '//_matrixCount++;',
                            replacement: '_matrixCount++;'
                        }, {
                            match: '//application.log_DEBUG',
                            replacement: 'application.log_DEBUG'
                        }, {
                            match: '//_DEBUG_STATS.',
                            replacement: '_DEBUG_STATS.'
                        }, {
                            match: '//egomModel.resetDebugStats();',
                            replacement: 'egomModel.resetDebugStats();'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['js/utils/matrices.js'], dest: 'js/utils/'},
                    {expand: true, flatten: true, src: ['js/modules/egom-model.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/scene/scene-graph.js'], dest: 'js/modules/scene/'},
                    {expand: true, flatten: true, src: ['js/modules/scene/renderable-objects.js'], dest: 'js/modules/scene/'},
                    {expand: true, flatten: true, src: ['js/modules/managed-gl.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/resource-manager.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/media-resources.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/modules/control.js'], dest: 'js/modules/'},
                    {expand: true, flatten: true, src: ['js/armada/graphics.js'], dest: 'js/armada/'},
                    {expand: true, flatten: true, src: ['js/armada/logic/equipment.js'], dest: 'js/armada/logic/'},
                    {expand: true, flatten: true, src: ['js/armada/logic/spacecraft.js'], dest: 'js/armada/logic/'}
                ]
            },
            dev: {
                options: {
                    patterns: [
                        {
                            match: 'main-optimized.js',
                            replacement: 'main.js'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['index.html'], dest: './'}
                ]
            },
            sass: {
                options: {
                    patterns: [
                        {
                            match: 'sourceMappingURL=css/',
                            replacement: 'sourceMappingURL='
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['css/*.css'], dest: './css'}
                ]
            }
        }
    });
    // Plugins
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-replace');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-json-minify');
    // "Private" tasks (meant only to be used to construct the pulbic tasks, not to be run directly)
    grunt.renameTask('clean', '_clean');
    grunt.renameTask('eslint', '_eslint');
    grunt.renameTask('replace', '_replace');
    grunt.renameTask('sass', '_sass');
    grunt.renameTask('requirejs', '_requirejs');
    grunt.renameTask('json-minify', '_minify');
    // "Public" tasks (meant to be run directly)
    grunt.registerTask('default', ['build']);
    grunt.registerTask('build', ['_sass:dist', '_minify:dist', '_replace:preOptimize', '_requirejs', '_replace:dist', '_replace:optimize', '_replace:postOptimize']);
    grunt.registerTask('clean', ['_clean:dev', '_replace:dev']);
    grunt.registerTask('lint', ['_eslint']);
    grunt.registerTask('dev-build', ['_sass:dev', '_replace:sass']);
    grunt.registerTask('css-build', ['_sass:dist']);
};