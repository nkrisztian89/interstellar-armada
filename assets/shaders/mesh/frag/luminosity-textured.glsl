vec4 texLum = texture2D(u_emissiveTexture, v_texCoord);

gl_FragColor.rgb = 
    v_luminosityFactor * texLum.rgb;