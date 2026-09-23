var TypeRip = {
    fetchWithProxy: function(url, onSuccess, onError) {
        axios.get("/api/proxy?url=" + encodeURIComponent(url))
        .then(onSuccess)
        .catch(function() {
            axios.get("https://api.allorigins.win/raw?url=" + encodeURIComponent(url))
            .then(onSuccess)
            .catch(onError);
        });
    },

    handleRequest: function(input_, callback_){
        if(!input_ || typeof input_ !== "string" || !input_.trim()){
            callback_("error", "Por favor, digite ou cole uma URL ou o nome de uma fonte (Google Fonts ou Adobe Fonts).");
            return;
        }
        var query = input_.trim();

        // 1. Use the unified server-side font resolution API
        axios.get("/api/font?query=" + encodeURIComponent(query))
        .then(function(response){
            if(response.data && response.data.fonts && response.data.fonts.length > 0){
                callback_("success", response.data);
            }else{
                callback_("error", "Nenhum estilo de fonte foi encontrado.");
            }
        })
        .catch(function(err){
            // Fallback for Adobe collection or client-side direct handling if needed
            if(query.indexOf("fonts.adobe.com/collections") !== -1){
                TypeRip.getFontCollection(query, callback_);
            }else if(query.indexOf("fonts.adobe.com") !== -1){
                TypeRip.getFontFamily(query, callback_);
            }else{
                var msg = (err.response && err.response.data) ? err.response.data : err.message;
                callback_("error", msg || "Não foi possível carregar a fonte.");
            }
        });
    },

    getFontCollection: function(url_, callback_){
        this.fetchWithProxy(url_, function (response) {
            var fontCollection = {
                provider: "adobe",
                isCollection: true,
                name: "",
                designers: [],
                fonts: []
            };

            var str = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
            var json_start = str.indexOf('{"fontpack":{"all_valid_slugs":'); 
		    if(json_start === -1) {
                callback_("error", "Resposta inesperada do Adobe Fonts. Verifique a URL.");
                return;
            }

            var data = str.substring(json_start);
            var json_end = data.indexOf('</script>'); 
            if(json_end === -1) {
                callback_("error", "Erro ao processar dados da coleção Adobe Fonts.");
                return;
            }

            var json;
            try {
                json = JSON.parse(data.substring(0, json_end)); 
            }catch(e){
                callback_("error", "Erro ao analisar dados da coleção Adobe Fonts.");
                return;
            }

            fontCollection.defaultLanguage = json.fontpack.font_variations[0].default_language || "pt";
            fontCollection.sampleText = (json.textSampleData && json.textSampleData.textSamples[fontCollection.defaultLanguage]) 
                ? json.textSampleData.textSamples[fontCollection.defaultLanguage]["list"] 
                : "Todos os seres humanos nascem livres e iguais em dignidade e direitos."; 
            fontCollection.name = json.fontpack.name;

            fontCollection.designers.push({
                "name": json.fontpack.contributor_credit || "Adobe Fonts",
                "url": url_
            });
            
            for (var i = 0; i < json.fontpack.font_variations.length; i++) {
                var v = json.fontpack.font_variations[i];
                fontCollection.fonts.push({
                    url: "https://use.typekit.net/pf/tk/" + v.opaque_id + "/" + v.fvd + "/a?unicode=AAAAAQAAAAEAAAAB&features=ALL&v=3&ec_token=3bb2a6e53c9684ffdc9a9bf71d5b2a620e68abb153386c46ebe547292f11a96176a59ec4f0c7aacfef2663c08018dc100eedf850c284fb72392ba910777487b32ba21c08cc8c33d00bda49e7e2cc90baff01835518dde43e2e8d5ebf7b76545fc2687ab10bc2b0911a141f3cf7f04f3cac438a135f", 
                    name: v.full_name,
                    style: v.variation_name, 
                    familyName: json.fontpack.name,
                    familyUrl: "https://fonts.adobe.com/fonts/" + v.family_slug,
                    isAdobe: true,
                    provider: "adobe"
                });
            }	

            callback_("success", fontCollection);
        }, function (error) {
            callback_("error", error.message);
        });
    },

    getFontFamily: function(url_, callback_) {
        this.fetchWithProxy(url_, function (response) {
            var fontFamily = {
                provider: "adobe",
                name: "",
                designers: [],
                fonts: []
            };

            var str = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
            var json_start = str.indexOf('{"family":{"slug":'); 
		    if(json_start === -1) {
                callback_("error", "Não foi possível encontrar a família no Adobe Fonts.");
                return;
            }

            var data = str.substring(json_start);
            var json_end = data.indexOf('</script>'); 
            if(json_end === -1) {
                callback_("error", "Erro ao processar dados da família Adobe Fonts.");
                return;
            }

            var json;
            try {
                json = JSON.parse(data.substring(0, json_end)); 
            }catch(e){
                callback_("error", "Erro ao analisar JSON da família.");
                return;
            }

            fontFamily.defaultLanguage = json.family.default_language || "pt";
            fontFamily.sampleText = (json.textSampleData && json.textSampleData.textSamples[fontFamily.defaultLanguage]) 
                ? json.textSampleData.textSamples[fontFamily.defaultLanguage]["list"] 
                : "Todos os seres humanos nascem livres e iguais em dignidade e direitos."; 
            fontFamily.name = json.family.name;

            for (var i = 0; i < json.family.designers.length; i++) {
                var designer = {
                    "name": json.family.designers[i].name,
                    "url": ""
                };

                if(json.designer_info && json.designer_info[json.family.designers[i].slug]){
                    designer["url"] = "https://fonts.adobe.com" + json.designer_info[json.family.designers[i].slug].url;
                }

                fontFamily.designers.push(designer);
            }

            for (var j = 0; j < json.family.fonts.length; j++) {
                var f = json.family.fonts[j];
                fontFamily.fonts.push({
                    url: "https://use.typekit.net/pf/tk/" + f.family.web_id + "/" + f.font.web.fvd + "/a?unicode=AAAAAQAAAAEAAAAB&features=ALL&v=3&ec_token=3bb2a6e53c9684ffdc9a9bf71d5b2a620e68abb153386c46ebe547292f11a96176a59ec4f0c7aacfef2663c08018dc100eedf850c284fb72392ba910777487b32ba21c08cc8c33d00bda49e7e2cc90baff01835518dde43e2e8d5ebf7b76545fc2687ab10bc2b0911a141f3cf7f04f3cac438a135f", 
                    name: f.name,
                    style: f.variation_name, 
                    familyName: fontFamily.name,
                    familyUrl: "https://fonts.adobe.com/fonts/" + json.family.slug,
                    isAdobe: true,
                    provider: "adobe"
                });
            }	
            callback_("success", fontFamily);
        }, function (error) {
            callback_("error", error.message);
        });
    },

    downloadFonts: function(fonts_, zipFileName_, rawDownload_, onProgress_){
        var fontList = [];
        if(Array.isArray(fonts_)){
            fontList = fonts_;
        }else{
            fontList = [fonts_];
            zipFileName_ = fonts_.name || (fonts_.familyName + " " + fonts_.style);
        }

        if(fontList.length === 0){
            return;
        }

        var zip = new JSZip();
        var fontProcessCounter = 0;
        var totalFonts = fontList.length;

        if(onProgress_){
            onProgress_(0, totalFonts);
        }

        for(var i = 0; i < fontList.length; i++) {
            (function(fontItem){
                TypeRip.getAndRepairFont(fontItem, rawDownload_, function(fontBuffer, fontMeta){
                    fontProcessCounter++;
                    if(onProgress_){
                        onProgress_(fontProcessCounter, totalFonts);
                    }

                    if(fontBuffer){
                        var safeName = (fontMeta.name || fontMeta.style || "font").replace(/[/\\?%*:|"<>]/g, "_");
                        
                        // Detect extension from buffer bytes: OTTO for .otf, otherwise .ttf
                        var ext = ".ttf";
                        try {
                            var view = new Uint8Array(fontBuffer);
                            if(view[0] === 0x4F && view[1] === 0x54 && view[2] === 0x54 && view[3] === 0x4F){
                                ext = ".otf";
                            }
                        } catch(e) {}

                        zip.file(safeName + ext, fontBuffer);
                    }

                    if(fontProcessCounter === totalFonts){
                        zip.generateAsync({type:"blob"})
                        .then(function(content) {
                            var safeZipName = (zipFileName_ || "fonts").replace(/[/\\?%*:|"<>]/g, "_");
                            saveAs(content, safeZipName + ".zip");
                            if(onProgress_){
                                onProgress_(totalFonts, totalFonts, true);
                            }
                        });
                    }
                });
            })(fontList[i]);
        }
    },

    getAndRepairFont: function(font_, rawDownload_, callback_) {
        var fetchBuffer = function(url, done) {
            axios.get(url, { responseType: 'arraybuffer' })
            .then(function(res) {
                done(res.data);
            })
            .catch(function() {
                axios.get("/api/proxy?url=" + encodeURIComponent(url), { responseType: 'arraybuffer' })
                .then(function(proxyRes) {
                    done(proxyRes.data);
                })
                .catch(function(err) {
                    console.error("Fetch failed for font:", font_.name, err);
                    done(null);
                });
            });
        };

        // If raw download is requested or if it is already a complete Google Font TTF:
        if(rawDownload_ || font_.isGoogle || font_.raw){
            fetchBuffer(font_.url, function(buf) {
                callback_(buf, font_);
            });
            return;
        }

        // For Adobe Fonts: fetch buffer and repair using OpenType.js
        fetchBuffer(font_.url, function(rawBuf) {
            if(!rawBuf){
                callback_(null, font_);
                return;
            }

            try {
                if(typeof opentype === "undefined" || !opentype.parse){
                    // Fallback to raw buffer if opentype is missing
                    callback_(rawBuf, font_);
                    return;
                }

                var fontData_ = opentype.parse(rawBuf);

                var unitsPerEm = fontData_.unitsPerEm || (fontData_.tables.head && fontData_.tables.head.unitsPerEm) || 1000;
                var ascender = fontData_.ascender || (fontData_.tables.hhea && fontData_.tables.hhea.ascender) || 800;
                var descender = fontData_.descender || (fontData_.tables.hhea && fontData_.tables.hhea.descender) || -200;
                if (descender >= 0) {
                    descender = -descender || -200;
                }

                var rebuiltGlyphs = [];
                for(var i = 0; i < fontData_.glyphs.length; i++) {
                    var glyph = fontData_.glyphs.get(i);
                    var adv = (typeof glyph.advanceWidth === "number" && !isNaN(glyph.advanceWidth)) 
                        ? glyph.advanceWidth 
                        : (glyph.getBoundingBox().x2 || 500);
                    var lsb = (typeof glyph.leftSideBearing === "number" && !isNaN(glyph.leftSideBearing)) 
                        ? glyph.leftSideBearing 
                        : 0;

                    var rebuiltGlyph = new opentype.Glyph({
                        name: glyph.name,
                        unicode: glyph.unicode,
                        unicodes: glyph.unicodes,
                        path: glyph.path,
                        index: glyph.index !== undefined ? glyph.index : i,
                        advanceWidth: adv,
                        leftSideBearing: lsb
                    });
                    rebuiltGlyph.advanceWidth = adv;
                    rebuiltGlyph.leftSideBearing = lsb;
                    rebuiltGlyphs.push(rebuiltGlyph);
                }

                var newFontData = {
                    familyName: font_.familyName || font_.name,
                    styleName: font_.style || "Regular",
                    unitsPerEm: unitsPerEm,
                    ascender: ascender,
                    descender: descender,
                    glyphs: rebuiltGlyphs
                };

                var newFont = new opentype.Font(newFontData);
                var repairedBuf = newFont.toArrayBuffer();
                callback_(repairedBuf, font_);
            } catch(repairErr) {
                console.warn("OpenType reconstruction failed, downloading clean raw buffer:", repairErr);
                callback_(rawBuf, font_);
            }
        });
    }
};
