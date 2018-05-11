// ==UserScript==
// @name         TruyenFull downloader
// @namespace    https://baivong.github.io/
// @description  Tải truyện từ truyenfull.vn định dạng epub
// @version      4.0.0
// @icon         https://i.imgur.com/FQY8btq.png
// @author       Zzbaivong
// @license      MIT; https://baivong.mit-license.org/license.txt
// @include      http://truyenfull.vn/*
// @exclude      http://truyenfull.vn/
// @exclude      http://truyenfull.vn/*/chuong-*
// @exclude      http://truyenfull.vn/danh-sach/*
// @exclude      http://truyenfull.vn/the-loai/*
// @exclude      http://truyenfull.vn/tac-gia/*
// @exclude      http://truyenfull.vn/contact/
// @exclude      http://truyenfull.vn/tos/
// @exclude      http://truyenfull.vn/sitemap.xml
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @require      https://unpkg.com/jepub/dist/jepub.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@1.3.8/FileSaver.min.js
// @require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @noframes
// @connect      self
// @supportURL   https://github.com/lelinhtinh/Userscript/issues
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// ==/UserScript==

(function ($, window, document) {
    'use strict';

    /**
     * Hiển thị liên kết xem online cuối chương
     * [>]
     * @type {Boolean} true
     *                 false
     */
    var readOnline = false;

    /**
     * Thời gian giãn cách giữa 2 lần tải
     * @type {Number}
     */
    var downloadDelay = 100;


    function cleanHtml(str) {
        str = str.replace(/\s*Chương\s*\d+\s?:[^<\n]/, '');
        str = str.replace(/&nbsp;/gm, ' ');
        str = str.replace(/<(br|hr|img)([^>]+)?>/gm, '<$1$2 />');
        str = str.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]+/gm, ''); // eslint-disable-line
        return '<div>' + str + '</div>';
    }

    function downloadError(err) {
        $downloadStatus('danger');
        titleError.push(chapTitle);
        console.warn(err);
    }

    function saveEbook() {
        if (endDownload) return;
        endDownload = true;

        if (titleError.length) {
            titleError = '<p><strong>Các chương lỗi: </strong>' + titleError.join(', ') + '</p>';
        } else {
            titleError = '';
        }
        beginEnd = '<p>Nội dung từ <strong>' + begin + '</strong> đến <strong>' + end + '</strong></p>';

        jepub.notes(beginEnd + titleError + '<br /><br />' + credits);

        jepub.generate().then(function (epubZipContent) {
            document.title = '[⇓] ' + ebookTitle;
            $win.off('beforeunload');

            $download.attr({
                href: window.URL.createObjectURL(epubZipContent),
                download: ebookFilename
            }).text('Tải xong').off('click');
            $downloadStatus('success');

            saveAs(epubZipContent, ebookFilename);
        }).catch(function (err) {
            $downloadStatus('danger');
            console.error(err);
        });
    }

    function getContent() {
        if (endDownload) return;
        chapId = chapList[count];

        GM.xmlHttpRequest({
            method: 'GET',
            url: pathname + chapId + '/',
            onload: function (response) {
                var $data = $(response.responseText),
                    $chapter = $data.find('.chapter-c'),
                    $notContent = $chapter.find('script, style, a'),
                    $referrer = $chapter.find('[style]').filter(function () {
                        return (this.style.fontSize === '1px' || this.style.fontSize === '0px' || this.style.color === 'white');
                    });

                if (endDownload) return;

                chapTitle = $data.find('.chapter-title').text().trim();

                if (!$chapter.length) {
                    downloadError('Missing content.');
                } else {
                    $downloadStatus('warning');

                    var $img = $chapter.find('img');
                    if ($img.length) $img.replaceWith(function () {
                        return '<br /><a href="' + this.src + '">Click để xem ảnh</a><br />';
                    });

                    if ($notContent.length) $notContent.remove();
                    if ($referrer.length) $referrer.remove();

                    jepub.add(chapTitle, cleanHtml($chapter.html() + chapRef(referrer + chapId)));

                    if (count === 0) begin = chapTitle;
                    end = chapTitle;

                    $download.html('Đang tải: ' + Math.floor((count / chapListSize) * 100) + '%');

                    count++;
                    document.title = '[' + count + '] ' + pageName;
                    if (count >= chapListSize) {
                        saveEbook();
                    } else {
                        setTimeout(function () {
                            getContent();
                        }, downloadDelay);
                    }
                }
            },
            onerror: function (err) {
                downloadError(err);
                saveEbook();
            }
        });
    }


    var pageName = document.title,
        $win = $(window),

        $download = $('<a>', {
            class: 'btn btn-primary btn-lg',
            href: '#download',
            text: 'Tải xuống'
        }),
        $downloadStatus = function (status) {
            $download.removeClass('btn-primary btn-success btn-info btn-warning btn-danger').addClass('btn-' + status);
        },

        $novelId = $('#truyen-id'),
        chapList = [],
        chapListSize = 0,
        chapId = '',
        chapTitle = '',
        count = 0,
        begin = '',
        end = '',
        endDownload = false,

        ebookTitle = $('h1').text().trim(),
        ebookAuthor = $('.info a[itemprop="author"]').text().trim(),
        // ebookCover = $('.books img').attr('src'),
        // ebookDesc = $('.desc-text-full').html(),
        // ebookType = [],
        beginEnd = '',
        titleError = [],

        host = location.host,
        pathname = location.pathname,
        referrer = location.protocol + '//' + host + pathname,

        ebookFilename = pathname.slice(1, -1) + '.epub',

        credits = '<p>Truyện được tải từ <a href="' + referrer + '">TruyenFull</a></p><p>Userscript được viết bởi: <a href="https://github.com/lelinhtinh/jEpub">Zzbaivong</a></p>',
        chapRef = function (ref) {
            return readOnline ? '<p><a href="' + ref + '/" target="_blank">[>]</a></p>' : '';
        },

        jepub;


    if (!$novelId.length) return;

    // var $ebookType = $('.info a[itemprop="genre"]');
    // if ($ebookType.length) {
    //     $ebookType.each(function () {
    //         ebookType.push($(this).text().trim());
    //     });
    //     ebookType = ebookType.join(', ');
    //     ebookType = '<p><strong>Thể loại:</strong> ' + ebookType + '</p>';
    // } else {
    //     ebookType = '';
    // }

    jepub = new jEpub({
        title: ebookTitle,
        author: ebookAuthor,
        publisher: host
    }).uuid(referrer);

    $download.insertAfter('.info');
    $download.one('click contextmenu', function (e) {
        e.preventDefault();
        document.title = '[...] Vui lòng chờ trong giây lát';

        $.when($.get('/ajax.php', {
            type: 'hash'
        })).done(function (res) {
            $.get('/ajax.php', {
                type: 'chapter_option',
                data: $novelId.val(),
                bnum: '',
                num: 1,
                hash: res
            }).done(function (data) {
                chapList = data.match(/(?:value=")[^"]+(?=")/g).map(function (val) {
                    return val.slice(7);
                });

                if (e.type === 'contextmenu') {
                    var startFrom = prompt('Nhập ID chương truyện bắt đầu tải:', chapList[0]);
                    startFrom = chapList.indexOf(startFrom);
                    if (startFrom !== -1) chapList = chapList.slice(startFrom);
                }

                chapListSize = chapList.length;
                if (chapListSize > 0) {
                    $win.on('beforeunload', function () {
                        return 'Truyện đang được tải xuống...';
                    });

                    $download.one('click', function (e) {
                        e.preventDefault();
                        saveEbook();
                    });

                    getContent();
                }
            }).fail(function (jqXHR, textStatus) {
                downloadError(textStatus);
            });
        }).fail(function (jqXHR, textStatus) {
            downloadError(textStatus);
        });
    });

})(jQuery, window, document);
