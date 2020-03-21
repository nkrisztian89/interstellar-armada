#define MAX_DIR_LIGHTS 2

struct DirLight
    {
        lowp vec3 color;
        vec4 direction;
        mat4 matrix;
    };

uniform DirLight u_dirLights[MAX_DIR_LIGHTS];
uniform int u_numDirLights;