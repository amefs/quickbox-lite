// SPDX-License-Identifier: GPL-3.0-or-later

function getDayToday() {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNames[new Date().getDay()];
}

function getDateToday() {
    const monthNames = [
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
        "December",
    ];
    const date = new Date();
    const currentDate = date.getDate();
    let suffix = "th";

    if (currentDate === 1 || currentDate === 21 || currentDate === 31) {
        suffix = "st";
    } else if (currentDate === 2 || currentDate === 22) {
        suffix = "nd";
    } else if (currentDate === 3 || currentDate === 23) {
        suffix = "rd";
    }

    return `${currentDate}${suffix} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function toggleMenu($: JQueryStatic, marginLeft: number, marginMain: number) {
    if ($(".mainpanel").css("position") === "relative") {
        $(".logopanel, .leftpanel").animate({ left: marginLeft }, "fast");
        $(".headerbar, .mainpanel").animate({ left: marginMain }, "fast");
        $("body").css({ overflow: $("body").css("overflow") === "hidden" ? "" : "hidden" });
        return;
    }

    $(".logopanel, .leftpanel").animate({ marginLeft }, "fast");
    $(".headerbar, .mainpanel").animate({ marginLeft: marginMain }, "fast");
}

export function initializeQuickUi($: JQueryStatic) {
    $(document).ready(() => {
        $("#menuToggle").on("click", () => {
            const collapsedMargin = $(".mainpanel").css("margin-left");
            const collapsedLeft = $(".mainpanel").css("left");

            if (collapsedMargin === "280px" || collapsedLeft === "280px") {
                toggleMenu($, -280, 0);
            } else {
                toggleMenu($, 0, 280);
            }
        });

        $("#todayDay").text(getDayToday());
        $("#todayDate").text(getDateToday());

        $(document).on("click", ".nav-parent > a", function (this: HTMLElement) {
            const gran = $(this).closest(".nav");
            const parent = $(this).parent();
            const sub = parent.find("> ul");

            if (sub.is(":visible")) {
                sub.slideUp(200);
                parent.removeClass("nav-active");
            } else {
                $(gran).find(".children").each(function (this: HTMLElement) {
                    $(this).slideUp();
                });
                sub.slideDown(200);
                if (!parent.hasClass("active")) {
                    parent.addClass("nav-active");
                }
            }
            return false;
        });

        $(".tooltips").tooltip({ container: "body" });
        $(".popovers").popover();

        $(".nav-due > li").hover(
            function (this: HTMLElement) {
                $(this).addClass("nav-hover");
            },
            function (this: HTMLElement) {
                $(this).removeClass("nav-hover");
            },
        );

        $("#noticeDropdown").on("click", ".nav-tabs a", function (this: HTMLElement) {
            $(this).closest(".btn-group").addClass("dontClose");
        });

        $("#noticePanel").on("hide.bs.dropdown", function (this: HTMLElement, event: JQuery.TriggeredEvent) {
            if ($(this).hasClass("dontClose")) {
                event.preventDefault();
            }
            $(this).removeClass("dontClose");
        });

        $(".panel-remove").on("click", function (this: HTMLElement) {
            $(this).closest(".panel").fadeOut(function (this: HTMLElement) {
                $(this).remove();
            });
        });

        $(".panel-minimize").on("click", function (this: HTMLElement) {
            const parent = $(this).closest(".panel");

            parent.find(".panel-body").slideToggle(() => {
                parent.find(".panel-heading").toggleClass("min");
            });
        });
    });
}
