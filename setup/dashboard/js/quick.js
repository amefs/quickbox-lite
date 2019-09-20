

$(document).ready(function() {

  'use strict';

  /***** SHOW / HIDE LEFT MENU *****/

  $('#menuToggle').click(function() {

    var collapsedMargin = $('.mainpanel').css('margin-left');
    var collapsedLeft = $('.mainpanel').css('left');

    if(collapsedMargin === '280px' || collapsedLeft === '280px') {
      toggleMenu(-280,0);
    } else {
      toggleMenu(0,280);
    }

  });


  function toggleMenu(marginLeft, marginMain) {

    var emailList = ($(window).width() <= 768 && $(window).width() > 640)? 320 : 360;

    if($('.mainpanel').css('position') === 'relative') {

      $('.logopanel, .leftpanel').animate({left: marginLeft}, 'fast');
      $('.headerbar, .mainpanel').animate({left: marginMain}, 'fast');

      $('.emailcontent, .email-options').animate({left: marginMain}, 'fast');
      $('.emailpanel').animate({left: marginMain + emailList}, 'fast');

      if($('body').css('overflow') == 'hidden') {
        $('body').css({overflow: ''});
      } else {
        $('body').css({overflow: 'hidden'});
      }

    } else {

      $('.logopanel, .leftpanel').animate({marginLeft: marginLeft}, 'fast');
      $('.headerbar, .mainpanel').animate({marginLeft: marginMain}, 'fast');

      $('.emailcontent, .email-options').animate({left: marginMain}, 'fast');
      $('.emailpanel').animate({left: marginMain + emailList}, 'fast');

    }

  }


  /****** PULSE A QUICK ACCESS PANEL ******/

  $('.panel-quick-page .panel').hover(function() {
    $(this).addClass('flip animated');
  }, function() {
    $(this).removeClass('flip animated');
  });



  // Date Today in Notification
  $('#todayDay').text(getDayToday());
  $('#todayDate').text(getDateToday());

   // Toggle Left Menu
   $('.nav-parent > a').on('click', function() {

     var gran = $(this).closest('.nav');
     var parent = $(this).parent();
     var sub = parent.find('> ul');

     if(sub.is(':visible')) {
       sub.slideUp(200);
       if(parent.hasClass('nav-active')) { parent.removeClass('nav-active'); }
     } else {

       $(gran).find('.children').each(function() {
         $(this).slideUp();
       });

       sub.slideDown(200);
       if(!parent.hasClass('active')) { parent.addClass('nav-active'); }
     }
    return false;

   });

   function closeVisibleSubMenu() {
      $('.leftpanel .nav-parent').each(function() {
         var t = jQuery(this);
         if(t.hasClass('nav-active')) {
            t.find('> ul').slideUp(200, function(){
               t.removeClass('nav-active');
            });
         }
      });
   }

   // Left Panel Toggles
   $('.leftpanel-toggle').toggles({
     on: true,
     height: 11
   });
   $('.leftpanel-toggle-off').toggles({ height: 11 });


   // Tooltip
   $('.tooltips').tooltip({ container: 'body'});

   // Popover
   $('.popovers').popover();

   // Add class everytime a mouse pointer hover over it
   $('.nav-due > li').hover(function(){
      $(this).addClass('nav-hover');
   }, function(){
      $(this).removeClass('nav-hover');
   });

   // Prevent dropdown from closing when clicking inside
   $('#noticeDropdown').on('click', '.nav-tabs a', function(){
     // set a special class on the '.dropdown' element
     $(this).closest('.btn-group').addClass('dontClose');
   })

   $('#noticePanel').on('hide.bs.dropdown', function(e) {
     if ( $(this).hasClass('dontClose') ){
       e.preventDefault();
     }
     $(this).removeClass('dontClose');
   });


   // Close panel
   $('.panel-remove').click(function() {
     $(this).closest('.panel').fadeOut(function() {
       $(this).remove();
     });
   });

   // Minimize panel
   $('.panel-minimize').click(function() {
     var parent = $(this).closest('.panel');

     parent.find('.panel-body').slideToggle(function() {
       var panelHeading = parent.find('.panel-heading');

       if(panelHeading.hasClass('min')) {
         panelHeading.removeClass('min');
       } else {
         panelHeading.addClass('min');
       }

     });

   });

   /* Get the current day today */
   function getDayToday() {
     // Get Date Today
     var d_names = new Array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday");
     var d = new Date();
     var curr_day = d.getDay();

     return d_names[curr_day];
   }

   /* Get the current date today */
   function getDateToday() {
     var m_names = new Array("January", "February", "March", "April", "May", "June", "July", "August", "September",
                             "October", "November", "December");

     var d = new Date();
     var curr_date = d.getDate();
     var sup = "";

     if (curr_date == 1 || curr_date == 21 || curr_date ==31) {
       sup = "st";
     } else if (curr_date == 2 || curr_date == 22) {
       sup = "nd";
     } else if (curr_date == 3 || curr_date == 23) {
       sup = "rd";
     } else {
       sup = "th";
     }

     var curr_month = d.getMonth();
     var curr_year = d.getFullYear();

     return curr_date + sup + " " + m_names[curr_month] + " " + curr_year;
   }

   /* This function will reposition search form to the left panel when viewed
    * in screens smaller than 767px and will return to top when viewed higher
    * than 767px
    */
   function reposition_searchform() {
      if($('.searchform').css('position') == 'relative') {
         $('.searchform').insertBefore('.leftpanelinner .userlogged');
      } else {
         $('.searchform').insertBefore('.header-right');
      }
   }



   /* This function allows top navigation menu to move to left navigation menu
    * when viewed in screens lower than 1024px and will move it back when viewed
    * higher than 1024px
    */
   function reposition_topnav() {
      if($('.nav-horizontal').length > 0) {

         // top navigation move to left nav
         // .nav-horizontal will set position to relative when viewed in screen below 1024
         if($('.nav-horizontal').css('position') == 'relative') {

            if($('.leftpanel .nav-bracket').length == 2) {
               $('.nav-horizontal').insertAfter('.nav-bracket:eq(1)');
            } else {
               // only add to bottom if .nav-horizontal is not yet in the left panel
               if($('.leftpanel .nav-horizontal').length == 0)
                  $('.nav-horizontal').appendTo('.leftpanelinner');
            }

            $('.nav-horizontal').css({display: 'block'})
                                  .addClass('nav-pills nav-stacked nav-bracket');

            $('.nav-horizontal .children').removeClass('dropdown-menu');
            $('.nav-horizontal > li').each(function() {

               $(this).removeClass('open');
               $(this).find('a').removeAttr('class');
               $(this).find('a').removeAttr('data-toggle');

            });

            if($('.nav-horizontal li:last-child').has('form')) {
               $('.nav-horizontal li:last-child form').addClass('searchform').appendTo('.topnav');
               $('.nav-horizontal li:last-child').hide();
            }

         } else {
            // move nav only when .nav-horizontal is currently from leftpanel
            // that is viewed from screen size above 1024
            if($('.leftpanel .nav-horizontal').length > 0) {

               $('.nav-horizontal').removeClass('nav-pills nav-stacked nav-bracket')
                                        .appendTo('.topnav');
               $('.nav-horizontal .children').addClass('dropdown-menu').removeAttr('style');
               $('.nav-horizontal li:last-child').show();
               $('.searchform').removeClass('searchform').appendTo('.nav-horizontal li:last-child .dropdown-menu');
               $('.nav-horizontal > li > a').each(function() {

                  $(this).parent().removeClass('nav-active');

                  if($(this).parent().find('.dropdown-menu').length > 0) {
                     $(this).attr('class','dropdown-toggle');
                     $(this).attr('data-toggle','dropdown');
                  }

               });
            }

         }

      }
   }

});
