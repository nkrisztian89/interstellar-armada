vec4 texLum = texture2D(u_emissiveTexture, v_texCoord);

gl_FragColor.rgb = 
    // add diffuse texture lighted by luminosity factor
    v_luminosity * diffuseColor.rgb
    // add the luminosity texture
    + v_luminosityFactor * texLum.rgb;