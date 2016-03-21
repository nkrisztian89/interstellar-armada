#define MAX_DIR_LIGHTS 2

struct DirLight
    {
        vec3 color;
        vec3 direction;
        mat4 matrix;
        vec3 translationVector;
    };

uniform DirLight u_dirLights[MAX_DIR_LIGHTS];
uniform int u_numDirLights;