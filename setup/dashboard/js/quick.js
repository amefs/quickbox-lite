// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

$(document).ready(function () {
  /** SHOW / HIDE LEFT MENU **/

  $("#menuToggle").click(function () {
    const collapsedMargin = $(".mainpanel").css("margin-left");
    const collapsedLeft = $(".mainpanel").css("left");

    if (collapsedMargin === "280px" || collapsedLeft === "280px") {
      toggleMenu(-280, 0);
    } else {
      toggleMenu(0, 280);
    }
  });

  function toggleMenu (marginLeft, marginMain) {
    if ($(".mainpanel").css("position") === "relative") {
      $(".logopanel, .leftpanel").animate({ left: marginLeft }, "fast");
      $(".headerbar, .mainpanel").animate({ left: marginMain }, "fast");

      if ($("body").css("overflow") === "hidden") {
        $("body").css({ overflow: "" });
      } else {
        $("body").css({ overflow: "hidden" });
      }
    } else {
      // eslint-disable-next-line object-shorthand
      $(".logopanel, .leftpanel").animate({ marginLeft: marginLeft }, "fast");
      $(".headerbar, .mainpanel").animate({ marginLeft: marginMain }, "fast");
    }
  }

  // Date Today in Notification
  $("#todayDay").text(getDayToday());
  $("#todayDate").text(getDateToday());

  // Toggle Left Menu
  $(document).on("click", ".nav-parent > a", function () {
    const gran = $(this).closest(".nav");
    const parent = $(this).parent();
    const sub = parent.find("> ul");

    if (sub.is(":visible")) {
      sub.slideUp(200);
      if (parent.hasClass("nav-active")) {
        parent.removeClass("nav-active");
      }
    } else {
      $(gran)
        .find(".children")
        .each(function () {
          $(this).slideUp();
        });

      sub.slideDown(200);
      if (!parent.hasClass("active")) {
        parent.addClass("nav-active");
      }
    }
    return false;
  });

  // Tooltip
  $(".tooltips").tooltip({ container: "body" });

  // Popover
  $(".popovers").popover();

  // Add class everytime a mouse pointer hover over it
  $(".nav-due > li").hover(
    function () {
      $(this).addClass("nav-hover");
    },
    function () {
      $(this).removeClass("nav-hover");
    }
  );

  // Prevent dropdown from closing when clicking inside
  $("#noticeDropdown").on("click", ".nav-tabs a", function () {
    // set a special class on the '.dropdown' element
    $(this).closest(".btn-group").addClass("dontClose");
  });

  $("#noticePanel").on("hide.bs.dropdown", function (e) {
    if ($(this).hasClass("dontClose")) {
      e.preventDefault();
    }
    $(this).removeClass("dontClose");
  });

  $(document).on("click", ".panel-remove", function () {
    $(this)
      .closest(".panel")
      .fadeOut(function () {
        $(this).remove();
      });
  });

  $(document).on("click", ".panel-minimize", function () {
    const parent = $(this).closest(".panel");

    parent.find(".panel-body").slideToggle(function () {
      const panelHeading = parent.find(".panel-heading");

      if (panelHeading.hasClass("min")) {
        panelHeading.removeClass("min");
      } else {
        panelHeading.addClass("min");
      }
    });
  });

  /* Get the current day today */
  function getDayToday () {
    // Get Date Today
    const d_names = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ];
    const d = new Date();
    const curr_day = d.getDay();

    return d_names[curr_day];
  }

  /* Get the current date today */
  function getDateToday () {
    const m_names = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];

    const d = new Date();
    const curr_date = d.getDate();
    let sup;

    if (curr_date === 1 || curr_date === 21 || curr_date === 31) {
      sup = "st";
    } else if (curr_date === 2 || curr_date === 22) {
      sup = "nd";
    } else if (curr_date === 3 || curr_date === 23) {
      sup = "rd";
    } else {
      sup = "th";
    }

    const curr_month = d.getMonth();
    const curr_year = d.getFullYear();

    return curr_date + sup + " " + m_names[curr_month] + " " + curr_year;
  }
});
