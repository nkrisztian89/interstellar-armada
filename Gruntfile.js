/*global module*/
module.exports = function (grunt) {
    "use strict";
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        requirejs: {
            compile: {
                options: {
                    baseUrl: "js",
                    name: "main",
                    optimize: "uglify2",
                    out: "js/main-optimized.js",
                    preserveLicenseComments: false
                }
            }
        },
        clean: ["js/main-optimized.js"]
    });
    // Plugins
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    // Tasks
    grunt.registerTask('default', ['requirejs']);
    grunt.registerTask('build', ['requirejs']);
};