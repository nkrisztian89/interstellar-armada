#version 100

#include "mesh/variables/camera.glsl"
#include "mesh/variables/model-base.glsl"
#include "mesh/variables/model-group-vert.glsl"
#include "mesh/variables/model-group-transform-vert.glsl"

#include "mesh/variables/model-text-vert.glsl"

void main() {
#include "mesh/vert/simple-position.glsl"    
#include "mesh/vert/model-tex.glsl"    
}
