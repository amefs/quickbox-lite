$(document).ready(function() {


// FLEXSLIDER - CONTENT SLIDER	

//	$('#slider').flexslider({
//        animation: 'slide',
//        animationLoop: false,
//        controlNav: false,
//        prevText: '',
//        nextText: '',
//    });


// FLEXSLIDER - IMAGE SLIDER	

//	$('.slider-images').flexslider({
//        animation: 'fade',
//        animationLoop: false,
//        controlNav: false,
//        prevText: '',
//        nextText: '',
//    });

//FLEXSLIDER NAVIGATION BUTTONS	

//	var buttons = $('.featured .flex-direction-nav');
	
//	$(".featured").hover( function() {
//		$(buttons).stop().fadeIn('fast')
//	}).mouseleave( function() {
//		$(buttons).stop().fadeOut('fast')
//	});   

//REMOVES JAVASCRIPT FIX CLASSES

//	$('#portfolio-content').removeClass("js-off-overflow");
//	$('.portfolio-thumbs').removeClass("js-off-position");

	
//INITIALIZES NIVO LIGHTBOX PLUGIN

//    $('a[data-nivo-rel^="nivoLightbox"]').nivoLightbox({
//        effect: 'fade'
//    });
    

//PREVENTING THE FLASH OF UNSTYLED CONTENT

	$('.no-fouc').removeClass('no-fouc');    

	
//INITIALIZES TWITTER FEED PLUGIN

	$('#twitter-feed').tweet({
		username: "myusername",  //just enter your twitter username 
		//modpath: "./twitter/",
		join_text: "auto",
		avatar_size: null,
		count: 2, //number of tweets showing
		auto_join_text_default: "",
		loading_text: "loading latest tweets..." //text displayed while loading tweets
	});


// REMOVES THE STICKY NAVIGATION FROM IE7

	if($.browser.msie && parseInt($.browser.version, 10) <= 7) {			
		$('#navigation').removeClass('sticky-nav');		
	}


//INITIALIZES THE PERSISTENT TOP NAVIGATION BAR ON SMALLER SCREENS

	$(window).load(function(){		
		$("#left").sticky({ topSpacing: 0 });
		$(".sticky-wrapper").css({height : '0'});			
	});


//LOCAL LINK FUNCTION	

	$('.local').click(function() {
		var ele = $(this);
		var location = $(ele).attr('href');
			
		$('html, body').animate({
			scrollTop: $(location).offset().top
		}, 1000);
	});

	
//NAVIGATION
	

//	$('#nav-scroll .navigation').onePageNav({
//		currentClass: 'active'
//	});


//ISOTOPE SETUP

    // cache container
//    var $container = $('.portfolio-thumbs');
//    var $filter_nav = $('.filters li a');
    // filter items when filter link is clicked

//    $filter_nav.click(function () {
//        $filter_nav.removeClass('current');
//        $(this).addClass('current');
//        var selector = $(this).attr('data-filter');
//        $container.isotope({
//            filter: selector
//        });
//        return false;
//    });

//    $(window).load(function () {
//        $('.portfolio-thumbs').isotope({
//            filter: '*',
//            layoutMode: 'fitRows'

//        });
//    });  
	

// PORTFOLIO HOVER EFFECT	

// $('ul.portfolio-thumbs li').hover(function(){  
//         $(".overlay", this).stop().animate({top:'0px'},{queue:false,duration:300});  
//     }, function() {  
//        $(".overlay", this).stop().animate({top:'190px'},{queue:false,duration:300});  
//    });  

	
//TOGGLE PANELS

	$('.toggle-content').hide();  //hides the toggled content, if the javascript is disabled the content is visible

	$('.toggle-link').click(function () {
		if ($(this).is('.toggle-close')) {
			$(this).removeClass('toggle-close').addClass('toggle-open').parent().next('.toggle-content').slideToggle(300);
			return false;
		} 
		
		else {
			$(this).removeClass('toggle-open').addClass('toggle-close').parent().next('.toggle-content').slideToggle(300);
			return false;
		}
	});



});	//END of jQuery





