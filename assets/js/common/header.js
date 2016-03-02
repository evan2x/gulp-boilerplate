$(function(){
  'use strict';

  var node = {
    $login: $('#login'),
    $logout: $('#logout'),
    $navigation: $('#navigation')
  }

  node.$login
    .on('click', function(e){
      e.preventDefault();
      var value = window.location.pathname + window.location.search;
      $.cookie('pc_curpage', value, {
        path: '/'
      });
      window.location.href = this.href;
    });

  var iframe = null;
  node.$logout
    .on('click', function(e){
      e.preventDefault();

      var href = this.href,
        beforeHref = this.getAttribute('data-before-href'),
        userId = this.getAttribute('data-id');

      /*if(!iframe){
        iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        iframe.onload = function(){
          window.location.href = href;
        }
      }

      iframe.src = beforeHref + '?lp='+ userId;*/
      
      $.ajax({
        url: beforeHref,
        data: {
          timestamp: new Date().getTime(),
          lp: userId
        }
      })
      .done(function(){
        window.location.href = href;
      });
    });

  node.$navigation
    .on('mouseenter mouseleave', 'li', function(e){
      var $this = $(this),
        subNav = $this.children('.sub-nav'),
        type = e.type;

      if(subNav.length){
        switch (e.type) {
          case 'mouseenter':
            $this.addClass('active');
            subNav.show();
            break;
          case 'mouseleave':
            $this.removeClass('active');
            subNav.hide();
        }
      }
    });
});
