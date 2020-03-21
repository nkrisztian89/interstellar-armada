/*jslint white: true*/
/*global module*/
module.exports = function (grunt) {
    "use strict";
    var scssMappings = {
        "css/general.css": 'src/scss/general.scss',
        "css/about.css": 'src/scss/screens/about.scss',
        "css/battle.css": 'src/scss/screens/battle.scss',
        "css/controls.css": 'src/scss/screens/controls.scss',
        "css/database.css": 'src/scss/screens/database.scss',
        "css/debriefing.css": 'src/scss/screens/debriefing.scss',
        "css/gameplay-settings.css": 'src/scss/screens/gameplay-settings.scss',
        "css/graphics.css": 'src/scss/screens/graphics.scss',
        "css/ingame-menu.css": 'src/scss/screens/ingame-menu.scss',
        "css/missions.css": 'src/scss/screens/missions.scss',
        "css/dialog.css": 'src/scss/components/dialog.scss',
        "css/infobox.css": 'src/scss/components/infobox.scss',
        "css/listcomponent.css": 'src/scss/components/listcomponent.scss',
        "css/loadingbox.css": 'src/scss/components/loadingbox.scss',
        "css/selector.css": 'src/scss/components/selector.scss',
        "css/slider.css": 'src/scss/components/slider.scss',
        "css/editor.css": 'src/scss/editor.scss'
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
                    out: "js/main.js",
                    preserveLicenseComments: false
                }
            }
        },
        _clean: {
            full: ["config/", "css/", "data/", "js/"],
            dist: ["js/*", "!js/main.js"]
        },
        _copy: {
            data: {
                files: [
                    {expand: true, cwd: 'src/config/', src: ['**'], dest: 'config/'},
                    {expand: true, cwd: 'src/data/', src: ['**'], dest: 'data/'}
                ]
            },
            js: {
                files: [
                    {expand: true, cwd: 'src/js/', src: ['**'], dest: 'js/'}
                ]
            }
        },
        _sync: {
            dev: {
                files: [
                    {expand: true, cwd: 'src/config/', src: ['**'], dest: 'config/'},
                    {expand: true, cwd: 'src/data/', src: ['**'], dest: 'data/'},
                    {expand: true, cwd: 'src/js/', src: ['**'], dest: 'js/'}
                ]
            }
        },
        _eslint: {
            options: {
                configFile: ".eslintrc.js"
            },
            target: ["src/js/"]
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
            config: {
                files: 'config/**/*.json'
            },
            data: {
                files: 'data/**/*.json'
            }
        },
        _replace: {
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
                    {expand: true, flatten: true, src: ['js/main.js'], dest: 'js/'}
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
        },
        _watch: {
            dev: {
                files: ['src/config/**', 'src/data/**', 'src/js/**'],
                tasks: ['_sync:dev'],
                options: {
                    spawn: true
                }
            },
            sass: {
                files: ['src/scss/**'],
                tasks: ['_sass:dev', '_replace:sass'],
                options: {
                    spawn: true
                }
            }
        },
        _concurrent: {
            watch: ['_watch:dev', '_watch:sass'],
            dev: [['_sass:dev', '_replace:sass'], '_copy:data', '_copy:js'],
            build: ['_sass:dist', ['_copy:data', '_minify:config', '_minify:data'], ['_copy:js', '_replace:preOptimize', '_requirejs', '_replace:optimize', '_clean:dist']]
        }
    });
    // Plugins
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-replace');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-json-minify');
    grunt.loadNpmTasks('grunt-sync');
    grunt.loadNpmTasks('grunt-concurrent');
    // "Private" tasks (meant only to be used to construct the pulbic tasks, not to be run directly)
    grunt.renameTask('copy', '_copy');
    grunt.renameTask('clean', '_clean');
    grunt.renameTask('eslint', '_eslint');
    grunt.renameTask('replace', '_replace');
    grunt.renameTask('sass', '_sass');
    grunt.renameTask('requirejs', '_requirejs');
    grunt.renameTask('json-minify', '_minify');
    grunt.renameTask('sync', '_sync');
    grunt.renameTask('watch', '_watch');
    grunt.renameTask('concurrent', '_concurrent');
    // "Public" tasks (meant to be run directly)
    grunt.registerTask('default', ['build']);
    grunt.registerTask('build', ['_concurrent:build']);
    grunt.registerTask('clean', ['_clean:full']);
    grunt.registerTask('lint', ['_eslint']);
    grunt.registerTask('dev-build', ['_concurrent:dev']);
    grunt.registerTask('css-build', ['_sass:dist']);
    grunt.registerTask('watch', ['_concurrent:watch']);
};