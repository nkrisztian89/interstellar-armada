#version 100

#include "billboard/billboard-vars-instanced.glsl"

void main() {
#include "billboard/billboard-base-instanced.glsl"
    v_opacity = i_direction.w;
}
