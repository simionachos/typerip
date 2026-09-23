Vue.component('font-panel', {
    props: ['fontname', 'fontstyle', 'fonturl', 'sampletext', 'familyurl', 'iscatalogitem', 'provider'],
    template: ' <div class="column four">\
                    <div class="item">\
                        <div class="upper" style="overflow: hidden;"><p :style="{fontFamily : fontname}">{{sampletext}}</p></div>\
                        <div class="lower">\
                            <div class="info_container">\
                                <a :href="familyurl" v-on:click.prevent="$emit(\'clickfamily\')"><p style="font-weight: 600;">{{fontname}}</p></a>\
                                <p class="small">\
                                    {{fontstyle}}\
                                    <span v-if="iscatalogitem" style="cursor: pointer; text-decoration: underline; color: #1967D2; margin-left: 6px; font-weight: 500;">Ver estilos</span>\
                                </p>\
                            </div>\
                            <div class="button_container">\
                                <a class="button" v-on:click="$emit(\'clickdownload\')" title="Download este estilo"><i class="icon ion-md-arrow-down"></i></a>\
                            </div>\
                        </div>\
                    </div>\
                </div>'
});

var typeRipVue = new Vue({
    el: '#typeripvue',
    data: {
        urlInput: "",
        fontIsActive: false,
        fontFamily: {},
        rawDownload: false,
        downloadProgress: {
            active: false,
            current: 0,
            total: 0,
            percentage: 0
        },
        message: {
            visible: true,
            title: "TypeRip - Google Fonts & Adobe Fonts",
            text: "<p style='margin-bottom: 8px;'>O TypeRip baixa e reconstrói fontes completas e instaláveis do <strong>Google Fonts</strong> e <strong>Adobe Fonts</strong>.</p>" +
                  "<p style='margin-bottom: 12px;'>Você pode digitar o nome da fonte ou colar qualquer link:</p>" +
                  "<div style='display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; font-size: 1.45rem;'>" +
                  "  <div style='background: #fff; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0;'>" +
                  "    <strong style='color: #1967D2;'><i class='icon ion-md-checkmark-circle-outline'></i> Google Fonts:</strong>" +
                  "    <ul style='margin-top: 6px; padding-left: 18px; line-height: 1.6;'>" +
                  "      <li>Cole URLs de espécime: <code>fonts.google.com/specimen/Google+Sans+Flex</code></li>" +
                  "      <li>Cole URLs de catálogo Latn em português</li>" +
                  "      <li>Ou digite apenas o nome: <code>Google Sans Flex</code>, <code>Roboto</code>, <code>Montserrat</code></li>" +
                  "    </ul>" +
                  "  </div>" +
                  "  <div style='background: #fff; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0;'>" +
                  "    <strong style='color: #C5221F;'><i class='icon ion-md-checkmark-circle-outline'></i> Adobe Fonts:</strong>" +
                  "    <ul style='margin-top: 6px; padding-left: 18px; line-height: 1.6;'>" +
                  "      <li>Cole URLs de famílias: <code>fonts.adobe.com/fonts/futura-pt</code></li>" +
                  "      <li>Cole coleções completas: <code>fonts.adobe.com/collections/...</code></li>" +
                  "      <li>Ou digite apenas o nome: <code>Futura PT</code>, <code>Acumin</code>, <code>Proxima Nova</code></li>" +
                  "    </ul>" +
                  "  </div>" +
                  "</div>"
        }
    },
    methods: {
        showMessage: function(title_, text_) {
            this.fontIsActive = false;
            this.message = {
                visible: true, 
                title: title_, 
                text: text_
            };
        },
        quickLoad: function(val) {
            this.urlInput = val;
            this.urlSubmitButtonPress();
        },
        urlSubmitButtonPress: function() {
            if(!this.urlInput || !this.urlInput.trim()){
                return;
            }
            this.showMessage("Carregando fontes...", "<p>Consultando e preparando os estilos das fontes...</p>");
            
            TypeRip.handleRequest(this.urlInput, (responseType_, response_) => {
                if(responseType_ === "error"){
                    this.showMessage("Erro ao buscar fonte", "<p>" + response_ + "</p>");
                }else{
                    this.fontFamily.provider = response_.provider || (this.urlInput.includes("adobe") ? "adobe" : "google");
                    this.fontFamily.name = response_.name;
                    this.fontFamily.designers = response_.designers || [];
                    this.fontFamily.fonts = response_.fonts || [];
                    this.fontFamily.sampleText = response_.sampleText || "Todos os seres humanos nascem livres e iguais em dignidade e direitos.";
                    this.fontIsActive = true;
                    this.downloadProgress.active = false;

                    // Inject @font-face declarations for immediate visual preview
                    this.fontFamily.fonts.forEach(font => {
                        var font_css = document.createElement('style');
                        font_css.appendChild(document.createTextNode("@font-face { font-family: '" + font.name.replace(/'/g, "\\'") + "'; src: url('" + font.url + "'); }"));
                        document.head.appendChild(font_css);
                    });
                }
            });
        },
        openFamily: function(font) {
            if (font && font.familyUrl) {
                this.urlInput = font.familyUrl;
                this.urlSubmitButtonPress();
            }
        },
        downloadSingleFont: function(font) {
            var fileName = font.name || (this.fontFamily.name + " " + font.style);
            TypeRip.downloadFonts(font, fileName, this.rawDownload);
        },
        downloadAll: function() {
            if(!this.fontFamily.fonts || this.fontFamily.fonts.length === 0){
                return;
            }

            this.downloadProgress.active = true;
            this.downloadProgress.current = 0;
            this.downloadProgress.total = this.fontFamily.fonts.length;
            this.downloadProgress.percentage = 0;

            TypeRip.downloadFonts(
                this.fontFamily.fonts, 
                this.fontFamily.name, 
                this.rawDownload, 
                (current, total, isComplete) => {
                    this.downloadProgress.current = current;
                    this.downloadProgress.total = total;
                    this.downloadProgress.percentage = total > 0 ? Math.round((current / total) * 100) : 0;
                    if(isComplete){
                        setTimeout(() => {
                            this.downloadProgress.active = false;
                        }, 2500);
                    }
                }
            );
        },
        getFontsInChunks: function(chunkSize_) {
            var output = [];
            if(this.fontFamily.fonts != null) {
                for(var i = 0; i < this.fontFamily.fonts.length; i++) {
                    if(i % chunkSize_ === 0 ){
                        output.push([]);
                    }
                    output[Math.floor(i / chunkSize_)].push(this.fontFamily.fonts[i]);
                }
                return output;
            } else {
                return [];
            }
        }
    }
});

// Helper for clickable example links
window.quickLoadFont = function(url) {
    if (typeRipVue) {
        typeRipVue.quickLoad(url);
    }
};
