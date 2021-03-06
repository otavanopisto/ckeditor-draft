(function() {
  'use strict'
  
  /* global CKEDITOR */
  
  var Confirm = null;

  function getHash(data) {
    var shaObj = new jsSHA("SHA-512", "TEXT");
    shaObj.update(data);
    return shaObj.getHash("HEX");
  }
  
  function getContent(editor) {
    return (editor.getData()||'').replace(/\n/g,"");
  }
  
  function getContentHash(editor) {
    return getHash(getContent(editor));
  }
  
  function compress(data, callback) {
    if (data) {
      new JSZip()
        .file('draft', data)
        .generateAsync({type : "string"})
        .then(function (compressed) {
          callback(null, compressed);
        });
    } else {
      callback(null, null);
    }
  }
  
  function uncompress(data, callback) {
    if (data) {
      new JSZip()
        .loadAsync(data)
        .then(function(zip) {
          try {
            var file = zip.file('draft');
            if (file) {
              file.async("string").then(function (uncompressed) {
                callback(null, uncompressed);
              });
            } else {
              callback('Invalid zip file');
            }
          } catch (e) {
            callback(e, null);
          }
        });
    } else {
      callback(null, null);
    }
  }
  
  function enquireRestore(editor) {
    var lang = editor.lang['draft'];
    var confirm = new Confirm(editor, { 
      text: '<div class="draft-restore"><span class="draft-label">' + lang.restoreDraftLabel + '</span><span class="draft-text">' + lang.restoreDraftText + '</span>{load}</div>',
      links: [{
        'id': 'load',
        'text': lang.restoreDraft,
        'click': CKEDITOR.tools.bind(function () {
          uncompress(this.getDraftData(), CKEDITOR.tools.bind(function (err, draftData) {
            if (err) {
              alert('Draft restore failed');
            }
            else {
              this.setData(draftData);
              confirm.hide();
            }
          }, this));
          
        }, editor)
      }]
    });
    
    confirm.show();
 }

  CKEDITOR.plugins.add('draft', {
    requires: ['notification','change'],
    lang: 'fi,en',
    init: function (editor) {
      if (!window.localStorage) {
        if (window.console) {
          console.error("Could not initialize draft plugin, because localStorage is not supported");
        } 
        return;
      }

      if (!window.jsSHA) {
        if (window.console) {
          console.error("Could not initialize draft plugin, because jsSHA is not loaded");
        } 
        return;
      }

      if (!window.JSZip) {
        if (window.console) {
          console.error("Could not initialize draft plugin, because JSZip is not loaded");
        } 
        return;
      }

      Confirm = CKEDITOR.tools.createClass({
        base: CKEDITOR.plugins.notification,
        
        $ : function(editor, options) {
          var message = options.text;
          
          if (options.links) {
            for (var i = 0, l = options.links.length; i < l; i++) {
              var link = options.links[i];
              var clickRef = CKEDITOR.tools.addFunction(link.click);
              var linkHtml = '<a href="javascript:CKEDITOR.tools.callFunction(' + clickRef + ')">' + link.text + '</a>';
              message = message.replace('{' + link.id + '}', linkHtml);
            }
          }
          
          this.base(editor, {
            duration: 60000,
            message: message
          });
        }
      });
      
      editor.on('instanceReady', function(event) {
        if (!this.config.manualDraftStart) {
          event.editor.startDrafting();
        }
      });
      
      editor.getDraftTime = CKEDITOR.tools.bind(function () {
        return localStorage.getItem(this.config.draftKey + '.time');
      }, editor);
      
      editor.getDraftHash = CKEDITOR.tools.bind(function () {
        return localStorage.getItem(this.config.draftKey + '.hash');
      }, editor);
      
      editor.getDraftData = CKEDITOR.tools.bind(function () {
        return localStorage.getItem(this.config.draftKey + '.data');
      }, editor);
      
      editor.startDrafting = CKEDITOR.tools.bind(function () {
        if (!this._isDrafting) {
          this._isDrafting = true;
          this._originalContentHash = getContentHash(this);
          var draftTime = this.getDraftTime();
          if (draftTime) {
            enquireRestore(this);
          }
          this.on('contentChange', function (event) {
            if (event.editor._draftStoreTimeout) {
              clearTimeout(event.editor._draftStoreTimeout);
            }
            event.editor._draftStoreTimeout = CKEDITOR.tools.setTimeout(function() {
              event.editor.storeDraft();
            }, 1000, event.editor);
          });
        }
      }, editor);
      
      editor.storeDraft = CKEDITOR.tools.bind(function () {
        var contents = getContent(this);
        var hash = getHash(contents);
        if (this._originalContentHash != hash) {
          compress(contents, CKEDITOR.tools.bind(function (err, compressed) {
            if (err) {
              if (window.console) {
                console.error(err);
              } 
            } else {
              localStorage.setItem(this.config.draftKey + '.time', new Date().getTime());
              localStorage.setItem(this.config.draftKey + '.hash', hash);
              localStorage.setItem(this.config.draftKey + '.data', compressed);
            }
          }, this));
        }
      }, editor);
      
      editor.discardDraft = CKEDITOR.tools.bind(function() {
        localStorage.removeItem(this.config.draftKey + '.time');
        localStorage.removeItem(this.config.draftKey + '.hash');
        localStorage.removeItem(this.config.draftKey + '.data');
      }, editor);
    }
  });
  
}).call(this);