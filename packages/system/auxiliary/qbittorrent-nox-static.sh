#!/bin/bash
#
# [qBittorrent static build script]
#
# Author:   EFS
#
# credits: - https://github.com/userdocs/qbittorrent-nox-static
#          - https://gist.github.com/notsure2
#
# Different:
# - rewrite arguments explanation, check parameters before installing dependencies
# - detect installed libs (if choosed not to clean)
#
# shellcheck disable=SC2034,SC1091,SC2068
#################################################################################
# Set some script features - https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html
#################################################################################
set -a
#####################################################################################################################################################
# Unset some variables to set defaults.
#####################################################################################################################################################
unset qb_skip_delete qb_git_proxy qb_curl_proxy qb_install_dir qb_build_dir \
qb_working_dir qb_modules_test qb_python_version qb_patches_url \
libt_master_check qbit_master_check libt_tag_check libt_tag qbit_tag_check qbit_tag \
qb_skip_bison qb_skip_gawk qb_skip_glibc qb_skip_zlib qb_skip_icu qb_skip_openssl \
qb_skip_qtbase qb_skip_qttools patch_repo_check patch_repo info_verbose cstandard
delete=() # modules listed in this array will be removed from teh default list of modules, changing the behaviour of all or install
#####################################################################################################################################################
# Color me up Scotty - define some color values to use as variables in the scripts.
#####################################################################################################################################################
cr="\e[31m" && clr="\e[91m" # [c]olor[r]ed     && [c]olor[l]ight[r]ed
cg="\e[32m" && clg="\e[92m" # [c]olor[g]reen   && [c]olor[l]ight[g]reen
cy="\e[33m" && cly="\e[93m" # [c]olor[y]ellow  && [c]olor[l]ight[y]ellow
cb="\e[34m" && clb="\e[94m" # [c]olor[b]lue    && [c]olor[l]ight[b]lue
cm="\e[35m" && clm="\e[95m" # [c]olor[m]agenta && [c]olor[l]ight[m]agenta
cc="\e[36m" && clc="\e[96m" # [c]olor[c]yan    && [c]olor[l]ight[c]yan
#
tb="\e[1m" && td="\e[2m" && tu="\e[4m" && tn="\n" # [t]ext[b]old && [t]ext[d]im && [t]ext[u]nderlined && [t]ext[n]ewline
#
cdef="\e[39m" # [c]olor[default]
cend="\e[0m"  # [c]olor[end]
#####################################################################################################################################################
# CHeck we are on a supported OS and release.
#####################################################################################################################################################
function checkos() {
    DISTRO="$(source /etc/os-release && printf "%s" "${ID}")"                             # Get the main platform name, for example: debian, ubuntu or alpine
    CODENAME="$(source /etc/os-release && printf "%s" "${VERSION_CODENAME}")" # Get the codename for this this OS. Note, ALpine does not have a unique codename.
    OSVERSION="$(source /etc/os-release && printf "%s" "${VERSION_ID}")"             # Get the version number for this codename, for example: 10, 20.04, 3.12.4
    #
    if [[ "${DISTRO}" =~ ^(alpine)$ ]]; then # If alpine, set the codename to alpine. We check for min v3.10 later with codenames.
        CODENAME="alpine"
    fi
    #
    ## Check against allowed codenames or if the codename is alpine version greater thab 3.10
    if [[ ! "${CODENAME}" =~ ^(alpine|buster|bionic|focal|jammy)$ ]] || [[ "${CODENAME}" =~ ^(alpine)$ && "${OSVERSION//\./}" -lt "3100" ]]; then
        echo
        echo -e " ${cly}This is not a supported OS. There is no reason to continue.${cend}"
        echo
        echo -e " id: ${td}${cly}${DISTRO}${cend} codename: ${td}${cly}${CODENAME}${cend} version: ${td}${clr}${OSVERSION}${cend}"
        echo
        echo -e " ${td}These are the supported platforms${cend}"
        echo
        echo -e " ${clm}Debian${cend} - ${clb}buster${cend}"
        echo
        echo -e " ${clm}Ubuntu${cend} - ${clb}bionic${cend} - ${clb}focal${cend} - ${clb}jammy${cend}"
        echo
        echo -e " ${clm}Alpine${cend} - ${clb}3.10.0${cend} or greater"
        echo
        exit
    fi
}
#####################################################################################################################################################
# 2:  curl test download functions - default is no proxy - curl is a test function and curl_curl is the command function
#####################################################################################################################################################
curl_curl() {
    if [[ -z "${qb_curl_proxy}" ]]; then
        "$(type -P curl)" -sNL4fq --connect-timeout 5 --retry 5 --retry-delay 5 --retry-max-time 25 "${@}"
    else
        "$(type -P curl)" -sNL4fq --connect-timeout 5 --retry 5 --retry-delay 5 --retry-max-time 25 --proxy-insecure -x "${qb_curl_proxy}" "${@}"
    fi

}

curl() {
    if ! curl_curl "${@}"; then
        echo 'error_url'
    fi
}
#####################################################################################################################################################
# 3: git test download functions - default is no proxy - git is a test function and git_git is the command function
#####################################################################################################################################################
function git_git() {
    if [[ -z "${qb_git_proxy}" ]]; then
        "$(type -P git)" "${@}"
    else
        "$(type -P git)" -c http.sslVerify=false -c http.https://github.com.proxy="${qb_git_proxy}" "${@}"
    fi
}
#
function git() {
    if [[ "${2}" = '-t' ]]; then
        url_test="${1}"
        tag_flag="${2}"
        tag_test="${3}"
    else
        url_test="${11}" # 11th place in our download folder function
    fi
    #
    if ! curl -I "${url_test%\.git}" &> /dev/null; then
        echo
        echo -e " ${cy}There is an issue with your proxy settings or network connection${cend}"
        echo
        exit
    fi
    #
    status="$(
        git_git ls-remote --exit-code "${url_test}" "${tag_flag}" "${tag_test}" &> /dev/null
        echo "${?}"
    )"
    #
    if [[ "${tag_flag}" = '-t' && "${status}" = '0' ]]; then
        echo "${tag_test}"
    elif [[ "${tag_flag}" = '-t' && "${status}" -ge '1' ]]; then
        echo 'error_tag'
    else
        if ! git_git "${@}"; then
            echo
            echo -e " ${cy}There is an issue with your proxy settings or network connection${cend}"
            echo
            exit
        fi
    fi
}
#
function test_git_ouput() {
    echo -e "${cm}➜ Checking ${clb}${3}${cend} ${cm}tag${cend}"
    if [[ "${1}" = 'error_tag' ]]; then
        echo -e "${cr}✗ The provided ${clb}${3}${cend} ${cr}tag ${cy}$2${cend} ${cr}is not valid${cend}"
        exit 1
    else
        echo -e "${cg}✓ The provided ${clb}${3}${cend} ${cg}tag ${cy}$2${cend} ${cg}is valid${cend}"
    fi
}
#####################################################################################################################################################
# This function sets the build and installation directory. If the argument -b is used to set a build directory that directory is set and used.
# If nothing is specified or the switch is not used it defaults to the hard-coded path relative to the scripts location - qbittorrent-build
#####################################################################################################################################################
function set_build_directory() {
    if [[ -n "${qb_build_dir}" ]]; then
        if [[ "${qb_build_dir}" =~ ^/ ]]; then
            qb_install_dir="${qb_build_dir}"
            qb_install_dir_short="${qb_install_dir/$HOME/\~}"
        else
            qb_install_dir="${qb_working_dir}/${qb_build_dir}"
            qb_install_dir_short="${qb_working_dir_short}/${qb_build_dir}"
        fi
    fi
    #
    ## Set lib and include directory paths based on install path.
    include_dir="${qb_install_dir}/include"
    lib_dir="${qb_install_dir}/lib"
    #
    ## Define some build specific variables
    PATH="${qb_install_dir}/bin:${HOME}/bin${PATH:+:${PATH}}"
    LD_LIBRARY_PATH="-L${lib_dir}"
    PKG_CONFIG_PATH="-L${lib_dir}/pkgconfig"
}
#####################################################################################################################################################
# This function sets some compiler flags globally - b2 settings are set in the ~/user-config.jam  set in the installation_modules function
#####################################################################################################################################################
function custom_flags_set() {
    CXXFLAGS="${optimize/*/$optimize }-std=${standard}"
    CPPFLAGS="${optimize/*/$optimize }--static -static -I${include_dir}"
    LDFLAGS="${optimize/*/$optimize }--static -static -Wl,--no-as-needed -L${lib_dir} -lpthread -pthread"
}
#
function custom_flags_reset() {
    CXXFLAGS="${optimize/*/$optimize }-std=${standard}"
    CPPFLAGS=""
    LDFLAGS=""
}
#####################################################################################################################################################
# This function sets some default values we use but whose values can be overridden by certain flags
#####################################################################################################################################################
set_default_values() {
    DEBIAN_FRONTEND="noninteractive" TZ="GMT" # For docker deploys to not get prompted to set the timezone.
    #
    glibc_version='2.31'
    #
    qb_patches_url="" # Provide a git username and repo in this format - username/repo" - In this repo the structure needs to be like this /patches/libtorrent/1.2.11/patch and/or /patches/qbittorrent/4.3.1/patch and you patch file will be automatically fetched and loadded for those matching tags.
    #
    libtorrent_version='1.2' # Set this here so it is easy to see and change
    #
    qt_version='5.15' # Set this here so it is easy to see and change
    #
    qb_python_version="3" # we are only using python3 but it's easier to just change this if we need to.
    #
    if [[ -z ${cstandard} ]]; then
        cstandard="17"
    fi
    standard="c++${cstandard}" # Set the cxx standard. You need to set c++14 for older version sof some apps, like qt 5.12
    # Define our list of available modules in an array.
    qb_modules=("all" "install" "bison" "gawk" "glibc" "zlib" "icu" "openssl" "boost" "libtorrent" "qtbase" "qttools" "qbittorrent")
    #
    if [[ "${DISTRO}" =~ ^(alpine)$ ]]; then # if alpines delete modules we don't use and set the required packages array
        delete+=("bison" "gawk" "glibc")
        qb_basic_required_pkgs=("bash" "bash-completion" "curl" "git")
        qb_required_pkgs=("build-base" "pkgconf" "autoconf" "automake" "libtool" "perl" "python${qb_python_version}" "python${qb_python_version}-dev" "py${qb_python_version}-numpy" "py${qb_python_version}-numpy-dev" "linux-headers")
    fi
    #
    if [[ "${DISTRO}" =~ ^(debian|ubuntu)$ ]]; then # if debian based set the required packages array
        qb_basic_required_pkgs=("curl" "git")
        qb_required_pkgs=("build-essential" "pkg-config" "automake" "libtool" "perl" "python${qb_python_version}" "python${qb_python_version}-dev" "python${qb_python_version}-numpy")
    fi
    #
    if [[ "${1}" != 'install' ]]; then # remove this module by default unless provided as a first argument to the script.
        delete+=("install")
    fi
    #
    if [[ "${qb_skip_icu}" != 'no' ]]; then # skip icu by default unless the -i flag is used
        delete+=("icu")
    fi
    #
    qb_working_dir="$(printf "%s" "$(pwd <(dirname "${0}"))")" # Get the full path to the scripts location to use with setting some path related variables.
    qb_working_dir_short="${qb_working_dir/$HOME/\~}"          # echo the working dir but replace the $HOME path with ~
    #
    qb_install_dir="${qb_working_dir}/qb-build"       # install relative to the script location.
    qb_install_dir_short="${qb_install_dir/$HOME/\~}" # echo the install dir but replace the $HOME path with ~
}
#####################################################################################################################################################
# This function will check for a list of defined dependencies from the qb_required_pkgs array. Apps like python3 and python2 are dynamically set
#####################################################################################################################################################
function precheck_dependencies() {
    echo -e "${tn}${tb}Checking if required basic dependencies are installed${cend}${tn}"
    #
    for pkg in "${qb_basic_required_pkgs[@]}"; do
        #
        if [[ "${DISTRO}" =~ ^(alpine)$ ]]; then
            pkgman() { apk info -e "${pkg}"; }
        fi
        #
        if [[ "${DISTRO}" =~ ^(debian|ubuntu)$ ]]; then
            pkgman() { dpkg -s "${pkg}"; }
        fi
        #
        if pkgman > /dev/null 2>&1; then
            echo -e " Dependency - ${cg}OK${cend} - ${pkg}"
        else
            if [[ -n "${pkg}" ]]; then
                deps_installed='no'
                echo -e " Dependency - ${cr}NO${cend} - ${pkg}"
                qb_basic_checked_required_pkgs+=("$pkg")
            fi
        fi
    done
    #
    if [[ "${deps_installed}" = 'no' ]]; then # Check if user is able to install the dependencies, if yes then do so, if no then exit.
        if [[ "$(id -un)" = 'root' ]]; then
            echo -e "${tn}${cg}Updating Repo${cend}${tn}"
            #
            if [[ "${DISTRO}" =~ ^(alpine)$ ]]; then
                CDN_URL="http://dl-cdn.alpinelinux.org/alpine/latest-stable/main"
                if [[ "${info_verbose}" = 'yes' ]]; then
                    apk update --repository="${CDN_URL}"
                    apk fix
                else
                    apk update --repository="${CDN_URL}" > /dev/null 2>&1
                    apk fix > /dev/null 2>&1
                fi
            fi
            #
            if [[ "${DISTRO}" =~ ^(debian|ubuntu)$ ]]; then
                if [[ "${info_verbose}" = 'yes' ]]; then
                    apt-get update -y
                    apt-get autoremove -y
                else
                    apt-get update -y > /dev/null 2>&1
                    apt-get autoremove -y > /dev/null 2>&1
                fi
            fi
            echo -e "${tn}${cg}Repo Updated${cend}${tn}"
            #
            [[ -f /var/run/reboot-required ]] && {
                echo -e "${tn}${cr}This machine requires a reboot to continue installation. Please reboot now.${cend}${tn}"
                exit
            }
            #
            echo -e "${tn}${cg}Installing required basic dependencies${cend}${tn}"
            #
            if [[ "${DISTRO}" =~ ^(alpine)$ ]]; then
                if [[ "${info_verbose}" = 'yes' ]]; then
                    if ! apk add "${qb_basic_checked_required_pkgs[@]}" --repository="${CDN_URL}"; then
                        echo
                        exit 1
                    fi
                else
                    for depend in ${qb_basic_checked_required_pkgs[@]}; do
                        echo -e "${cm}➜ Installing ${depend}... ${cend}"
                        apk add "${depend}" --repository="${CDN_URL}" > /dev/null 2>&1 || exit 1
                        echo -e "${cg}✓ ${depend} installed${cend}"
                    done
                fi

            fi
            #
            if [[ "${DISTRO}" =~ ^(debian|ubuntu)$ ]]; then
                if [[ "${info_verbose}" = 'yes' ]]; then
                    if ! apt-get install -y "${qb_basic_checked_required_pkgs[@]}"; then
                        echo
                        exit 1
                    fi
                else
                    for depend in ${qb_basic_checked_required_pkgs[@]}; do
                        echo -e "${cm}➜ Installing ${depend}... ${cend}"
                        apt-get -y --allow-unauthenticated -f install "${depend}" > /dev/null 2>&1 || exit 1
                        echo -e "${cg}✓ ${depend} installed${cend}"
                    done
                fi
            fi
            #
            echo -e "${tn}${cg}Basic dependencies installed!${cend}"
            #
            deps_installed='yes'
        else
            echo -e "${tn}${tb}Please request or install the missing basic dependencies before using this script${cend}"
            #
            echo -e "${tn}apk add ${qb_checked_required_pkgs[*]}${tn}"
            #
            exit
        fi
    fi
    #
    ## All checks passed echo
    if [[ "${deps_installed}" != 'no' ]]; then
        echo -e "${tn}${tb}All checks - ${cg}OK${cend}${tb} - basic dependencies are installed, continuing to build${cend}"
        echo
    fi
}
function check_dependencies() {
    echo -e "${tn}${tb}Checking if required core dependencies are installed${cend}${tn}"
    #
    for pkg in "${qb_required_pkgs[@]}"; do
        #
        if [[ "${DISTRO}" =~ ^(alpine)$ ]]; then
            pkgman() { apk info -e "${pkg}"; }
        fi
        #
        if [[ "${DISTRO}" =~ ^(debian|ubuntu)$ ]]; then
            pkgman() { dpkg -s "${pkg}"; }
        fi
        #
        if pkgman > /dev/null 2>&1; then
            echo -e " Dependency - ${cg}OK${cend} - ${pkg}"
        else
            if [[ -n "${pkg}" ]]; then
                deps_installed='no'
                echo -e " Dependency - ${cr}NO${cend} - ${pkg}"
                qb_checked_required_pkgs+=("$pkg")
            fi
        fi
    done
    #
    if [[ "${deps_installed}" = 'no' ]]; then # Check if user is able to install the dependencies, if yes then do so, if no then exit.
        if [[ "$(id -un)" = 'root' ]]; then
            echo -e "${tn}${cg}Updating${cend}${tn}"
            #
            if [[ "${DISTRO}" =~ ^(alpine)$ ]]; then
                CDN_URL="http://dl-cdn.alpinelinux.org/alpine/latest-stable/main"
                if [[ "${info_verbose}" = 'yes' ]]; then
                    apk update --repository="${CDN_URL}"
                    apk upgrade --repository="${CDN_URL}"
                    apk fix
                else
                    apk update --repository="${CDN_URL}" > /dev/null 2>&1
                    apk upgrade --repository="${CDN_URL}" > /dev/null 2>&1
                    apk fix > /dev/null 2>&1
                fi
            fi
            #
            if [[ "${DISTRO}" =~ ^(debian|ubuntu)$ ]]; then
                if [[ "${info_verbose}" = 'yes' ]]; then
                    apt-get update -y
                    apt-get upgrade -y
                    apt-get autoremove -y
                else
                    apt-get update -y > /dev/null 2>&1
                    apt-get upgrade -y > /dev/null 2>&1
                    apt-get autoremove -y > /dev/null 2>&1
                fi
            fi
            #
            [[ -f /var/run/reboot-required ]] && {
                echo -e "${tn}${cr}This machine requires a reboot to continue installation. Please reboot now.${cend}${tn}"
                exit
            }
            #
            echo -e "${tn}${cg}Installing required core dependencies${cend}${tn}"
            #
            if [[ "${DISTRO}" =~ ^(alpine)$ ]]; then
                if [[ "${info_verbose}" = 'yes' ]]; then
                    if ! apk add "${qb_checked_required_pkgs[@]}" --repository="${CDN_URL}"; then
                        echo
                        exit 1
                    fi
                else
                    for depend in ${qb_checked_required_pkgs[@]}; do
                        echo -e "${cm}➜ Installing ${depend}... ${cend}"
                        apk add "${depend}" --repository="${CDN_URL}" > /dev/null 2>&1 || exit 1
                        echo -e "${cg}✓ ${depend} installed${cend}"
                    done
                fi

            fi
            #
            if [[ "${DISTRO}" =~ ^(debian|ubuntu)$ ]]; then
                if [[ "${info_verbose}" = 'yes' ]]; then
                    if ! apt-get install -y "${qb_checked_required_pkgs[@]}"; then
                        echo
                        exit 1
                    fi
                else
                    for depend in ${qb_checked_required_pkgs[@]}; do
                        echo -e "${cm}➜ Installing ${depend}... ${cend}"
                        apt-get -y --allow-unauthenticated -f install "${depend}" > /dev/null 2>&1 || exit 1
                        echo -e "${cg}✓ ${depend} installed${cend}"
                    done
                fi
            fi
            #
            echo -e "${tn}${cg}Dependencies installed!${cend}"
            #
            deps_installed='yes'
        else
            echo -e "${tn}${tb}Please request or install the missing core dependencies before using this script${cend}"
            #
            echo -e "${tn}apk add ${qb_checked_required_pkgs[*]}${tn}"
            #
            exit
        fi
    fi
    #
    ## All checks passed echo
    if [[ "${deps_installed}" != 'no' ]]; then
        echo -e "${tn}${tb}All checks - ${cg}OK${cend}${tb} - core dependencies are installed, continuing to build${cend}"
    fi
}
#####################################################################################################################################################
# This function is where we set your URL that we use with other functions.
#####################################################################################################################################################
set_module_urls() {
    echo -e "${cm}➜ Initialing upstream repo${cend}"
    bison_url="http://ftpmirror.gnu.org/gnu/bison/$(grep -Eo 'bison-([0-9]{1,3}[.]?)([0-9]{1,3}[.]?)([0-9]{1,3}?)\.tar.gz' <(curl http://ftpmirror.gnu.org/gnu/bison/) | sort -V | tail -1)"
    #
    gawk_url="http://ftpmirror.gnu.org/gnu/gawk/$(grep -Eo 'gawk-([0-9]{1,3}[.]?)([0-9]{1,3}[.]?)([0-9]{1,3}?)\.tar.gz' <(curl http://ftpmirror.gnu.org/gnu/gawk/) | sort -V | tail -1)"
    #
    # glibc_url="http://ftpmirror.gnu.org/gnu/libc/$(grep -Eo 'glibc-([0-9]{1,3}[.]?)([0-9]{1,3}[.]?)([0-9]{1,3}?)\.tar.gz' <(curl http://ftpmirror.gnu.org/gnu/libc/) | sort -V | tail -1)"
    glibc_url="http://ftpmirror.gnu.org/gnu/libc/glibc-${glibc_version}.tar.gz"
    #
    zlib_github_tag="$(grep -Eom1 'v1.2.([0-9]{1,2})' <(curl https://github.com/madler/zlib/releases))"
    zlib_url="https://github.com/madler/zlib/archive/${zlib_github_tag}.tar.gz"
    #
    icu_url="$(grep -Eom1 'ht(.*)icu4c(.*)-src.tgz' <(curl https://api.github.com/repos/unicode-org/icu/releases/latest))"
    #
    openssl_github_tag="$(grep -Eom1 'OpenSSL_1_1_([0-9][a-z])' <(curl "https://github.com/openssl/openssl/releases"))"
    openssl_url="https://github.com/openssl/openssl/archive/${openssl_github_tag}.tar.gz"
    #
    boost_version="$(git_git ls-remote -t --refs https://github.com/boostorg/boost.git | awk '{sub("refs/tags/boost-", "");sub("(.*)(rc|alpha|beta)(.*)", ""); print $2 }' | awk '!/^$/' | sort -rV | head -n1)"
    boost_github_tag="boost-${boost_version}"
    boost_url="https://dl.bintray.com/boostorg/release/${boost_version}/source/boost_${boost_version//./_}.tar.gz"
    boost_url_status="$(curl_curl -so /dev/null --head --write-out '%{http_code}' "https://dl.bintray.com/boostorg/release/${boost_version}/source/boost_${boost_version//./_}.tar.gz")"
    boost_github_url="https://github.com/boostorg/boost.git"
    #
    qtbase_tags="$(git_git ls-remote -t --refs https://github.com/qt/qtbase.git | awk '{sub("refs/tags/", "");sub("(.*)(v6|rc|alpha|beta|-)(.*)", ""); print $2 }' | awk '!/^$/' | sort -rV)"
    qttools_tag="$(git_git ls-remote -t --refs https://github.com/qt/qttools.git | awk '{sub("refs/tags/", "");sub("(.*)(v6|rc|alpha|beta|-)(.*)", ""); print $2 }' | awk '!/^$/' | sort -rV)"
    #
    qtbase_github_tag="$(grep -Eom1 "v${qt_version}.([0-9]{1,2})" <<< "${qtbase_tags}")"
    qtbase_github_url="https://github.com/qt/qtbase.git"
    qttools_github_tag="$(grep -Eom1 "v${qt_version}.([0-9]{1,2})" <<< "${qttools_tag}")"
    qttools_github_url="https://github.com/qt/qttools.git"
    #
    libtorrent_github_url="https://github.com/arvidn/libtorrent.git"
    libtorrent_github_tag_default="$(grep -Eom1 "v${libtorrent_version}.([0-9]{1,2})" <(curl "https://github.com/arvidn/libtorrent/tags"))"
    libtorrent_github_tag="${libtorrent_github_tag:-$libtorrent_github_tag_default}"
    #
    qbittorrent_github_url="https://github.com/qbittorrent/qBittorrent.git"
    qbittorrent_github_tag_default="$(git_git ls-remote -t --refs https://github.com/qbittorrent/qBittorrent.git | awk '{sub("refs/tags/", "");sub("(.*)(rc|alpha|beta)(.*)", ""); print $2 }' | awk '!/^$/' | sort -rV | head -n1)"
    qbittorrent_github_tag="${qbitorrent_github_tag:-$qbittorrent_github_tag_default}"
    echo -e "${cg}✓ Upstream repo initialed${cend}"
}
#####################################################################################################################################################
# This function verifies the module names from the array qb_modules in the default values function.
#####################################################################################################################################################
installation_modules() {
    params_count="${#}"
    params_test=1
    #
    ## remove modules from the delete array from the qb_modules array
    for target in "${delete[@]}"; do
        for i in "${!qb_modules[@]}"; do
            if [[ "${qb_modules[i]}" = "${target}" ]]; then
                unset 'qb_modules[i]'
            fi
        done
    done
    #
    while [[ "${params_test}" -le "${params_count}" && "${params_count}" -gt '1' ]]; do
        if [[ "${qb_modules[*]}" =~ ${*:$params_test:1} ]]; then
            :
        else
            qb_modules_test="fail"
        fi
        params_test="$((params_test + 1))"
    done
    #
    if [[ "${params_count}" -le '1' ]]; then
        if [[ "${qb_modules[*]}" =~ ${*:$params_test:1} && -n "${*:$params_test:1}" ]]; then
            :
        else
            qb_modules_test="fail"
        fi
    fi
    #
    ## Activate all validated modules for installation and define some core variables.
    if [[ "${qb_modules_test}" != 'fail' ]]; then
        if [[ "${*}" =~ ([[:space:]]|^)"all"([[:space:]]|$) ]]; then
            for module in "${qb_modules[@]}"; do
                eval "skip_${module}=no"
            done
        else
            for module in "${@}"; do
                eval "skip_${module}=no"
            done
        fi
        #
        ## Create the directories we need.
        mkdir -p "${qb_install_dir}/logs"
        mkdir -p "${qb_install_dir}/completed"
        #
        ## Set some python variables we need.
        python_major="$(python"${qb_python_version}" -c "import sys; print(sys.version_info[0])")"
        python_minor="$(python"${qb_python_version}" -c "import sys; print(sys.version_info[1])")"
        python_micro="$(python"${qb_python_version}" -c "import sys; print(sys.version_info[2])")"
        #
        python_short_version="${python_major}.${python_minor}"
        python_link_version="${python_major}${python_minor}"
        #
        echo -e "using gcc : : : <cflags>${optimize/*/$optimize }-std=${standard} <cxxflags>${optimize/*/$optimize }-std=${standard} ;${tn}using python : ${python_short_version} : /usr/bin/python${python_short_version} : /usr/include/python${python_short_version} : /usr/lib/python${python_short_version} ;" > "$HOME/user-config.jam"
        #
        ## Echo the build directory.
        echo -e "${tn}${tb}Install Prefix${cend} : ${clc}${qb_install_dir_short}${cend}"
        #
    else
        echo -e "${tn} ${cr}One or more of the provided modules are not supported${cend}"
        echo -e "${tn}${tb}This is a list of supported modules${cend}"
        echo -e "${tn} ${clm}${qb_modules[*]}${tn}${cend}"
        ## Some basic help
        echo -e "${tn}${tb}Script help${cend} : ${clc}${qb_working_dir_short}/$(basename -- "$0")${cend} ${clb}-h${cend}"
        exit
    fi
}
function check_modules() {
    if [[ "${qb_skip_bison}" = 'yes' ]]; then
        if [[ ! -f ${qb_install_dir}/bin/bison ]]; then
            delete=("${delete[@]/bison/}")
        fi
    fi
    if [[ "${qb_skip_gawk}" = 'yes' ]]; then
        if [[ ! -f ${qb_install_dir}/bin/gawk ]]; then
            delete=("${delete[@]/gawk/}")
        fi
    fi
    if [[ "${qb_skip_glibc}" = 'yes' ]]; then
        if [[ ! -f ${qb_install_dir}/lib/libc-${glibc_version}.so ]]; then
            delete=("${delete[@]/glibc/}")
        fi
    fi
    if [[ "${qb_skip_zlib}" = 'yes' ]]; then
        if [[ ! -f ${qb_install_dir}/lib/pkgconfig/zlib.pc ]]; then
            delete=("${delete[@]/zlib/}")
        fi
    fi
    if [[ "${qb_skip_openssl}" = 'yes' ]]; then
        if [[ ! -f ${qb_install_dir}/lib/pkgconfig/openssl.pc ]]; then
            delete=("${delete[@]/openssl/}")
        fi
    fi
    if [[ "${qb_skip_qtbase}" = 'yes' ]]; then
        if [[ ! -f ${qb_install_dir}/lib/pkgconfig/Qt5Core.pc ]]; then
            delete=("${delete[@]/qtbase/}")
        fi
    fi
    if [[ "${qb_skip_qttools}" = 'yes' ]]; then
        if [[ ! -f ${qb_install_dir}/bin/qtattributionsscanner ]]; then
            delete=("${delete[@]/qttools/}")
        fi
    fi
}
#####################################################################################################################################################
# This function will test to see if a Jamfile patch file exists via the variable patches_github_url for the tag used.
#####################################################################################################################################################
function apply_patches() {
    patch_app_name="${1}"
    # Libtorrent has two tag formats libtorrent-1_2_11 and the newer v1.2.11. Moving forward v1.2.11 is the standard format. Make sure we always get the same outcome for either
    [[ "${libtorrent_github_tag}" =~ ^RC_ ]] && libtorrent_patch_tag="${libtorrent_github_tag}"
    [[ "${libtorrent_github_tag}" =~ ^libtorrent- ]] && libtorrent_patch_tag="${libtorrent_github_tag#libtorrent-}" && libtorrent_patch_tag="${libtorrent_patch_tag//_/\.}"
    [[ "${libtorrent_github_tag}" =~ ^v[0-9] ]] && libtorrent_patch_tag="${libtorrent_github_tag#v}"
    #
    # qbittorrent has a consistent tag format of release-4.3.1.
    qbittorrent_patch_tag="${qbittorrent_github_tag#release-}"
    #
    if [[ "${patch_app_name}" == 'bootstrap-help' ]]; then
        return
    fi
    #
    if [[ "${patch_app_name}" == 'bootstrap' ]]; then
        mkdir -p "${qb_install_dir}/patches/libtorrent/${libtorrent_patch_tag}"
        mkdir -p "${qb_install_dir}/patches/qbittorrent/${qbittorrent_patch_tag}"
    else
        patch_tag="${patch_app_name}_patch_tag"
        patch_dir="${qb_install_dir}/patches/${patch_app_name}/${!patch_tag}"
        patch_file="${patch_dir}/patch"
        patch_file_url="https://raw.githubusercontent.com/${qb_patches_url}/master/patches/${patch_app_name}/${!patch_tag}/patch"
        patch_jamfile="${qb_install_dir}/libtorrent/Jamfile"
        patch_jamfile_url="https://raw.githubusercontent.com/${qb_patches_url}/master/patches/${patch_app_name}/${!patch_tag}/Jamfile"
        #
        [[ ! -d "${patch_dir}" ]] && mkdir -p "${patch_dir}"
        #
        if [[ -f "${patch_file}" ]]; then
            [[ "${patch_app_name}" == 'libtorrent' ]] && echo # purely comsetic
            echo -e "${cr} Using ${!patch_tag} existing patch file${cend}"
            [[ "${patch_app_name}" == 'qbittorrent' ]] && echo # purely comsetic
        else
            if curl_curl "${patch_file_url}" -o "${patch_file}"; then
                [[ "${patch_app_name}" == 'libtorrent' ]] && echo # purely comsetic
                echo -e "${cr} Using ${!patch_tag} downloaded patch file${cend}"
                [[ "${patch_app_name}" == 'qbittorrent' ]] && echo # purely comsetic
            fi
        fi
        #
        if [[ "${patch_app_name}" == 'libtorrent' ]]; then
            if [[ -f "${patch_dir}/Jamfile" ]]; then
                cp -f "${patch_dir}/Jamfile" "${patch_jamfile}"
                echo
                echo -e "${cr} Using existing custom Jamfile file${cend}"
                echo
            elif curl_curl "${patch_jamfile_url}" -o "${patch_jamfile}"; then
                echo
                echo -e "${cr} Using downloaded custom Jamfile file${cend}"
                echo
            else
                curl_curl "https://raw.githubusercontent.com/arvidn/libtorrent/${libtorrent_patch_tag}/Jamfile" -o "${patch_jamfile}"
                echo
                echo -e "${cr} Using libtorrent branch master Jamfile file${cend}"
                echo
            fi
        fi
        #
        [[ -f "${patch_file}" ]] && patch -p1 < "${patch_file}"
    fi
}
function _apply_patches() {
    echo
    echo -e " ${cly}Using the defaults, these directories have been created:${cend}"
    echo
    echo -e " ${clc}$qb_install_dir_short/patches/libtorrent/${libtorrent_patch_tag}${cend}"
    echo
    echo -e " ${clc}$qb_install_dir_short/patches/qbittorrent/${qbittorrent_patch_tag}${cend}"
    echo
    echo -e " If a patch file, named ${cg}patch${cend} is found in these directories it will be applied to the relevant module with a matching tag."
    echo
}
#####################################################################################################################################################
# This function is to test a directory exists before attemtping to cd and fail with and exit code if it doesn't.
#####################################################################################################################################################
function _cd() {
    if cd "${1}" > /dev/null 2>&1; then
        cd "${1}" || exit
    else
        echo -e "This directory does not exist. There is a problem"
        echo
        echo -e "${clr}${1}${cend}"
        echo
        exit 1
    fi
}
#####################################################################################################################################################
# This function is for downloading source code archives
#####################################################################################################################################################
function download_file() {
    if [[ -n "${1}" ]]; then
        url_filename="${2}"
        [[ -n "${3}" ]] && subdir="/${3}" || subdir=""
        echo -e "${tn}${cg}Building $1${cend}${tn}"
        file_name="${qb_install_dir}/${1}.tar.gz"
        [[ -f "${file_name}" ]] && rm -rf {"${qb_install_dir:?}/$(tar tf "${file_name}" | grep -Eom1 "(.*)[^/]")","${file_name}"}
        curl "${url_filename}" -o "${file_name}"
        _cmd tar xf "${file_name}" -C "${qb_install_dir}"
        app_dir="${qb_install_dir}/$(tar tf "${file_name}" | head -1 | cut -f1 -d"/")${subdir}"
        mkdir -p "${app_dir}"
        _cd "${app_dir}"
    else
        echo
        echo "You must provide a filename name for the function - download_file"
        echo "It creates the name from the appname_github_tag variable set in the URL section"
        echo
        echo "download_file filename url"
        echo
        exit
    fi
}
#####################################################################################################################################################
# This function is for downloading git releases based on their tag.
#####################################################################################################################################################
function download_folder() {
    if [[ -n "${1}" ]]; then
        github_tag="${1}_github_tag"
        url_github="${2}"
        [[ -n "${3}" ]] && subdir="/${3}" || subdir=""
        echo -e "${tn}${cg}Building ${1}${cend}${tn}"
        folder_name="${qb_install_dir}/${1}"
        folder_inc="${qb_install_dir}/include/${1}"
        [[ -d "${folder_name}" ]] && rm -rf "${folder_name}"
        [[ "${1}" == 'libtorrent' && -d "${folder_inc}" ]] && rm -rf "${folder_inc}"
        if [[ "${info_verbose}" = 'yes' ]]; then
            _cmd git clone --no-tags --single-branch --branch "${!github_tag}" --shallow-submodules --recurse-submodules -j"$(nproc)" --depth 1 "${url_github}" "${folder_name}" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "cloning $(basename ${folder_name})"
            _cmd git clone --no-tags --single-branch --branch "${!github_tag}" --shallow-submodules --recurse-submodules -j"$(nproc)" --depth 1 "${url_github}" "${folder_name}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        mkdir -p "${folder_name}${subdir}"
        [[ -d "${folder_name}${subdir}" ]] && _cd "${folder_name}${subdir}"
    else
        echo
        echo "You must provide a tag name for the function - download_folder"
        echo "It creates the tag from the appname_github_tag variable set in the URL section"
        echo
        echo "download_folder tagname url subdir"
        echo
        exit
    fi
}
#####################################################################################################################################################
# This function is for removing files and folders we no longer need
#####################################################################################################################################################
function delete_function() {
    if [[ -n "${1}" ]]; then
        if [[ -z "${qb_skip_delete}" ]]; then
            [[ "$2" = 'last' ]] && echo -e "${tn}${clr}Deleting $1 installation files and folders${cend}${tn}" || echo -e "${tn}${clr}Deleting ${1} installation files and folders${cend}"
            #
            file_name="${qb_install_dir}/${1}.tar.gz"
            folder_name="${qb_install_dir}/${1}"
            [[ -f "${file_name}" ]] && rm -rf {"${qb_install_dir:?}/$(tar tf "${file_name}" | grep -Eom1 "(.*)[^/]")","${file_name}"}
            [[ -d "${folder_name}" ]] && rm -rf "${folder_name}"
            [[ -d "${qb_working_dir}" ]] && _cd "${qb_working_dir}"
        else
            [[ "${2}" = 'last' ]] && echo -e "${tn}${clr}Skipping $1 deletion${cend}${tn}" || echo -e "${tn}${clr}Skipping ${1} deletion${cend}"
        fi
    else
        echo
        echo "The delete_function works in tandem with the application_name function"
        echo "Set the appname using the application_name function then use this function."
        echo
        echo "delete_function appname"
        echo
        exit
    fi
}
#####################################################################################################################################################
# This function sets the name of the application to be used with the functions download_file/folder and delete_function
#####################################################################################################################################################
function application_name() {
    last_app_name="skip_${app_name}"
    app_name="${1}"
    app_name_skip="skip_${app_name}"
    app_url="${app_name}_url"
    app_github_url="${app_name}_github_url"
}
#####################################################################################################################################################
# This function skips the deletion of the -n flag is supplied
#####################################################################################################################################################
function application_skip() {
    if [[ "${1}" = 'last' ]]; then
        echo -e "${tn}Skipping ${clm}$app_name${cend} module installation${tn}"
    else
        echo -e "${tn}Skipping ${clm}$app_name${cend} module installation"
    fi
}
#####################################################################################################################################################
# This function installs qt
#####################################################################################################################################################
function install_qbittorrent() {
    if [[ -f "${qb_install_dir}/completed/qbittorrent-nox" ]]; then
        #
        if [[ "$(id -un)" = 'root' ]]; then
            mkdir -p "/usr/local/bin"
            cp -rf "${qb_install_dir}/completed/qbittorrent-nox" "/usr/local/bin"
        else
            mkdir -p "${HOME}/bin"
            cp -rf "${qb_install_dir}/completed/qbittorrent-nox" "${HOME}/bin"
        fi
        #
        echo -e " ${tn}${tu}qbittorrent-nox has been installed!${cend}${tn}"
        echo -e " Run it using this command:${tn}"
        #
        [[ "$(id -un)" = 'root' ]] && echo -e " ${cg}qbittorrent-nox${cend}${tn}" || echo -e " ${cg}~/bin/qbittorrent-nox${cend}${tn}"
        #
        exit
    elif [[ -f "${qb_install_dir}/completed/qbittorrent" ]]; then
        #
        if [[ "$(id -un)" = 'root' ]]; then
            mkdir -p "/usr/local/bin"
            cp -rf "${qb_install_dir}/completed/qbittorrent" "/usr/local/bin"
        else
            mkdir -p "${HOME}/bin"
            cp -rf "${qb_install_dir}/completed/qbittorrent" "${HOME}/bin"
        fi
        #
        echo -e " ${tn}${tu}qbittorrent has been installed!${cend}${tn}"
        echo -e " Run it using this command:${tn}"
        #
        [[ "$(id -un)" = 'root' ]] && echo -e " ${cg}qbittorrent${cend}${tn}" || echo -e " ${cg}~/bin/qbittorrent${cend}${tn}"
        #
        exit
    else
        echo -e "${tn}qbittorrent-nox/qbittorrent has not been built to the defined install directory:${tn}"
        echo -e "${cg}${qb_install_dir_short}/completed${cend}${tn}"
        echo -e "Please build it using the script first then install${tn}"
        #
        exit
    fi
}
#####################################################################################################################################################
# wtf is wrong now?
#####################################################################################################################################################
function _cmd() {
    if ! "${@}"; then
        echo
        exit 1
    fi
}
#####################################################################################################################################################
# verify if repo exist
#####################################################################################################################################################
function verify_repo() {
    if [[ "${libt_master_check}" = 'yes' ]]; then
        libtorrent_github_tag="$(git "${libtorrent_github_url}" -t "RC_${libtorrent_version//./_}")"
        test_git_ouput "${libtorrent_github_tag}" "RC_${libtorrent_version//./_}" "libtorrent"
    fi
    if [[ "${qbit_master_check}" = 'yes' ]]; then
        qbittorrent_github_tag="$(git "${qbittorrent_github_url}" -t "master")"
        test_git_ouput "${qbittorrent_github_tag}" "master" "qbittorrent"
    fi
    if [[ "${libt_tag_check}" = 'yes' ]]; then
        libtorrent_github_tag="$(git "${libtorrent_github_url}" -t "${libt_tag}")"
        test_git_ouput "${libtorrent_github_tag}" "${libt_tag}" "libtorrent"
    fi
    if [[ "${qbit_tag_check}" = 'yes' ]]; then
        qbittorrent_github_tag="$(git "${qbittorrent_github_url}" -t "${qbit_tag}")"
        test_git_ouput "${qbittorrent_github_tag}" "${qbit_tag}" "qbittorrent"
    fi
    if [[ "${patch_repo_check}" = 'yes' ]]; then
        if [[ "$(curl "https://github.com/${patch_repo}")" != 'error_url' ]]; then
            qb_patches_url="${patch_repo}"
        else
            echo
            echo -e " ${cy}This repo does not exist:${cend}"
            echo
            echo -e " https://github.com/${patch_repo}"
            echo
            echo -e " ${cy}Please provide a valid username and repo.${cend}"
            echo
            exit
        fi
    fi
}
function verify_url() {
    #
    url_test="$(curl -so /dev/null "https://www.google.com")"
    [[ "${url_test}" = "error_url" ]] && {
        echo
        echo -e "${cy}⚠ There is an issue with your proxy settings or network connection${cend}"
        echo
        exit 1
    }
}
spinner() {
    local pid=$1
    local delay=0.25
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [${cy}%c${cend}]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
    echo -ne "${cg}Done${cend}"
}
#####################################################################################################################################################
# Functions part 4: building scripts
#####################################################################################################################################################
function _build() {
#####################################################################################################################################################
# bison installation
#####################################################################################################################################################
    application_name bison
    #
    if [[ "${!app_name_skip:-yes}" = 'no' || "${1}" = "${app_name}" ]]; then
        custom_flags_reset
        download_file "${app_name}" "${!app_url}"
        #
        if [[ "${info_verbose}" = 'yes' ]]; then
            ./configure --prefix="${qb_install_dir}" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make -j"$(nproc)" CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make install |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "configuring ${app_name} ... "
            ./configure --prefix="${qb_install_dir}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "compiling ${app_name} ... "
            make -j"$(nproc)" CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "installing ${app_name} ... "
            make install >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        #
        delete_function "${app_name}"
    else
        application_skip
    fi
#####################################################################################################################################################
# gawk installation
#####################################################################################################################################################
    application_name gawk
    #
    if [[ "${!app_name_skip:-yes}" = 'no' || "$1" = "${app_name}" ]]; then
        custom_flags_reset
        download_file "${app_name}" "${!app_url}"
        #
        if [[ "${info_verbose}" = 'yes' ]]; then
            ./configure --prefix="$qb_install_dir" |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
            make -j"$(nproc)" CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make install |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "configuring ${app_name} ... "
            ./configure --prefix="$qb_install_dir" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "compiling ${app_name} ... "
            make -j"$(nproc)" CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "installing ${app_name} ... "
            make install >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        #
        delete_function "${app_name}"
    else
        application_skip
    fi
#####################################################################################################################################################
# glibc installation
#####################################################################################################################################################
    application_name glibc
    #
    if [[ "${!app_name_skip:-yes}" = 'no' || "${1}" = "${app_name}" ]]; then
        custom_flags_reset
        download_file "${app_name}" "${!app_url}"
        #
        mkdir -p build
        _cd "${app_dir}/build"
        if [[ "${info_verbose}" = 'yes' ]]; then
            "${app_dir}/configure" --prefix="${qb_install_dir}" --enable-static-nss |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
            make -j"$(nproc)" |& tee -a "${qb_install_dir}/logs/$app_name.log.txt"
            make install |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "configuring ${app_name} ... "
            "${app_dir}/configure" --prefix="${qb_install_dir}" --enable-static-nss >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "compiling ${app_name} ... "
            make -j"$(nproc)" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "installing ${app_name} ... "
            make install >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        #
        delete_function "${app_name}"
    else
        application_skip
    fi
#####################################################################################################################################################
# zlib installation
#####################################################################################################################################################
    application_name zlib
    #
    if [[ "${!app_name_skip:-yes}" = 'no' || "${1}" = "${app_name}" ]]; then
        custom_flags_set
        download_file "${app_name}" "${!app_url}"
        #
        if [[ "${info_verbose}" = 'yes' ]]; then
            ./configure --prefix="${qb_install_dir}" --static |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
            make -j"$(nproc)" CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make install |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "configuring ${app_name} ... "
            ./configure --prefix="${qb_install_dir}" --static >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "compiling ${app_name} ... "
            make -j"$(nproc)" CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "installing ${app_name} ... "
            make install >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        #
        delete_function "${app_name}"
    else
        application_skip
    fi
#####################################################################################################################################################
# ICU installation
#####################################################################################################################################################
    application_name icu
    #
    if [[ "${!app_name_skip:-yes}" = 'no' || "${1}" = "${app_name}" ]]; then
        custom_flags_reset
        download_file "${app_name}" "${!app_url}" "/source"
        #
        if [[ "${info_verbose}" = 'yes' ]]; then
            ./configure --prefix="${qb_install_dir}" --disable-shared --enable-static CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
            make -j"$(nproc)" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make install |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "configuring ${app_name} ... "
            ./configure --prefix="${qb_install_dir}" --disable-shared --enable-static CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "compiling ${app_name} ... "
            make -j"$(nproc)" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "installing ${app_name} ... "
            make install >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        #
        delete_function "${app_name}"
    else
        application_skip
    fi
#####################################################################################################################################################
# openssl installation
#####################################################################################################################################################
    application_name openssl
    #
    if [[ "${!app_name_skip:-yes}" = 'no' || "${1}" = "${app_name}" ]]; then
        custom_flags_set
        download_file "${app_name}" "${!app_url}"
        #
        if [[ "${info_verbose}" = 'yes' ]]; then
            ./config --prefix="${qb_install_dir}" threads no-shared no-dso no-comp CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
            make -j"$(nproc)" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make install_sw install_ssldirs |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "configuring ${app_name} ... "
            ./config --prefix="${qb_install_dir}" threads no-shared no-dso no-comp CXXFLAGS="${CXXFLAGS}" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "compiling ${app_name} ... "
            make -j"$(nproc)" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "installing ${app_name} ... "
            make install_sw install_ssldirs >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        #
        delete_function "${app_name}"
    else
        application_skip
    fi
#####################################################################################################################################################
# boost libraries install
#####################################################################################################################################################
    application_name boost
    #
    if [[ "${!app_name_skip:-yes}" = 'no' ]] || [[ "${1}" = "${app_name}" ]]; then
        custom_flags_set
        #
        [[ -d "${qb_install_dir}/boost" ]] && delete_function "${app_name}"
        #
        if [[ "${boost_url_status}" =~ (200) ]]; then
            download_file "${app_name}" "${boost_url}"
            mv -f "${qb_install_dir}/boost_${boost_version//./_}/" "${qb_install_dir}/boost"
            _cd "${qb_install_dir}/boost"
        fi
        #
        if [[ "${boost_url_status}" =~ (403|404) ]]; then
            download_folder "${app_name}" "${!app_github_url}"
        fi
        #
        if [[ "${info_verbose}" = 'yes' ]]; then
            "${qb_install_dir}/boost/bootstrap.sh" |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "${app_name} bootstrap ... "
            "${qb_install_dir}/boost/bootstrap.sh" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
    else
        application_skip
    fi
#####################################################################################################################################################
# libtorrent installation
#####################################################################################################################################################
    application_name libtorrent
    #
    if [[ "${!app_name_skip:-yes}" = 'no' ]] || [[ "${1}" = "${app_name}" ]]; then
        if [[ ! -d "${qb_install_dir}/boost" ]]; then
            echo -e "${tn}${clr}Warning${cend} - You must install the boost module before you can use the libtorrent module"
            echo
        else
            custom_flags_set
            download_folder "${app_name}" "${!app_github_url}"
            #
            apply_patches "${app_name}"
            #
            BOOST_ROOT="${qb_install_dir}/boost"
            BOOST_INCLUDEDIR="${qb_install_dir}/boost"
            BOOST_BUILD_PATH="${qb_install_dir}/boost"
            #
            if [[ "${info_verbose}" = 'yes' ]]; then
                "${qb_install_dir}/boost/b2" -j"$(nproc)" address-model="$(getconf LONG_BIT)" "${lt_debug}" optimization=speed cxxstd=${cstandard} dht=on encryption=on crypto=openssl i2p=on extensions=on variant=release threading=multi link=static boost-link=static cxxflags="${CXXFLAGS}" cflags="${CPPFLAGS}" linkflags="${LDFLAGS}" install --prefix="${qb_install_dir}" |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
            else
                echo "compiling ${app_name} ... "
                "${qb_install_dir}/boost/b2" -j"$(nproc)" address-model="$(getconf LONG_BIT)" "${lt_debug}" optimization=speed cxxstd=${cstandard} dht=on encryption=on crypto=openssl i2p=on extensions=on variant=release threading=multi link=static boost-link=static cxxflags="${CXXFLAGS}" cflags="${CPPFLAGS}" linkflags="${LDFLAGS}" install --prefix="${qb_install_dir}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
                echo
            fi
            #
            delete_function "${app_name}"
        fi
    else
        application_skip
    fi
#####################################################################################################################################################
# qtbase installation
#####################################################################################################################################################
    application_name qtbase
    #
    if [[ "${!app_name_skip:-yes}" = 'no' ]] || [[ "${1}" = "${app_name}" ]]; then
        custom_flags_set
        download_folder "${app_name}" "${!app_github_url}"
        #
        [[ "${qb_skip_icu}" = 'no' ]] && icu='-icu' || icu='-no-icu'
        #
        if [[ "${info_verbose}" = 'yes' ]]; then
            ./configure -prefix "${qb_install_dir}" "${icu}" -opensource -confirm-license -release -openssl-linked -static -c++std ${standard} -qt-pcre -no-iconv -no-feature-glib -no-feature-opengl -no-feature-dbus -no-feature-gui -no-feature-widgets -no-feature-testlib -no-compile-examples -I "${include_dir}" -L "${lib_dir}" QMAKE_LFLAGS="${LDFLAGS}" |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
            make -j"$(nproc)" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make install |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            echo "configuring ${app_name} ... "
            ./configure -prefix "${qb_install_dir}" "${icu}" -opensource -confirm-license -release -openssl-linked -static -c++std ${standard} -qt-pcre -no-iconv -no-feature-glib -no-feature-opengl -no-feature-dbus -no-feature-gui -no-feature-widgets -no-feature-testlib -no-compile-examples -I "${include_dir}" -L "${lib_dir}" QMAKE_LFLAGS="${LDFLAGS}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "compiling ${app_name} ... "
            make -j"$(nproc)" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "installing ${app_name} ... "
            make install >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        #
        delete_function "${app_name}"
    else
        application_skip
    fi
#####################################################################################################################################################
# qttools installation
#####################################################################################################################################################
    application_name qttools
    #
    if [[ "${!app_name_skip:-yes}" = 'no' ]] || [[ "${1}" = "${app_name}" ]]; then
        custom_flags_set
        download_folder "${app_name}" "${!app_github_url}"
        if [[ "${info_verbose}" = 'yes' ]]; then
            #
            "${qb_install_dir}/bin/qmake" -set prefix "${qb_install_dir}" |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
            #
            "${qb_install_dir}/bin/qmake" QMAKE_CXXFLAGS="-static" QMAKE_LFLAGS="-static" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make -j"$(nproc)" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            make install |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
        else
            #
            echo "configuring ${app_name} path ... "
            "${qb_install_dir}/bin/qmake" -set prefix "${qb_install_dir}" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "configuring ${app_name} ... "
            "${qb_install_dir}/bin/qmake" QMAKE_CXXFLAGS="-static" QMAKE_LFLAGS="-static" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "compiling ${app_name} ... "
            make -j"$(nproc)" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
            echo "installing ${app_name} ... "
            make install >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
            echo
        fi
        #
        delete_function "${app_name}"
    else
        application_skip
    fi
#####################################################################################################################################################
# qBittorrent installation
#####################################################################################################################################################
    application_name qbittorrent
    #
    if [[ "${!app_name_skip:-yes}" = 'no' ]] || [[ "${1}" = "${app_name}" ]]; then
        if [[ ! -d "${qb_install_dir}/boost" ]]; then
            echo -e "${tn}${clr}Warning${cend} - You must install the boost libtorrent qbtbase qttools modules before you can use the qbittorrent module"
            echo
        else
            custom_flags_set
            download_folder "${app_name}" "${!app_github_url}"
            #
            apply_patches "${app_name}"
            #
            export PKG_CONFIG_PATH="${lib_dir}/pkgconfig/"
            if [[ "${info_verbose}" = 'yes' ]]; then
                ./bootstrap.sh |& tee "${qb_install_dir}/logs/${app_name}.log.txt"
                ./configure --prefix="${qb_install_dir}" "${qb_debug}" --disable-gui --with-boost="${qb_install_dir}/boost" --with-boost-libdir="${lib_dir}" openssl_CFLAGS="${include_dir}" openssl_LIBS="${lib_dir}" CXXFLAGS="${CXXFLAGS} -I${qb_install_dir}/boost" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS} -l:libboost_system.a" openssl_CFLAGS="-I${include_dir}" openssl_LIBS="-L${lib_dir} -l:libcrypto.a -l:libssl.a" libtorrent_CFLAGS="-I${include_dir}" libtorrent_LIBS="-L${lib_dir} -l:libtorrent.a" zlib_CFLAGS="-I${include_dir}" zlib_LIBS="-L${lib_dir} -l:libz.a" QT_QMAKE="${qb_install_dir}/bin" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
                #
                make -j"$(nproc)" |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
                make install |& tee -a "${qb_install_dir}/logs/${app_name}.log.txt"
            else
                echo "initialing ${app_name} ... "
                ./bootstrap.sh >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
                echo
                echo "configuring ${app_name} ... "
                ./configure --prefix="${qb_install_dir}" "${qb_debug}" --disable-gui --with-boost="${qb_install_dir}/boost" --with-boost-libdir="${lib_dir}" openssl_CFLAGS="${include_dir}" openssl_LIBS="${lib_dir}" CXXFLAGS="${CXXFLAGS} -I${qb_install_dir}/boost" CPPFLAGS="${CPPFLAGS}" LDFLAGS="${LDFLAGS} -l:libboost_system.a" openssl_CFLAGS="-I${include_dir}" openssl_LIBS="-L${lib_dir} -l:libcrypto.a -l:libssl.a" libtorrent_CFLAGS="-I${include_dir}" libtorrent_LIBS="-L${lib_dir} -l:libtorrent.a" zlib_CFLAGS="-I${include_dir}" zlib_LIBS="-L${lib_dir} -l:libz.a" QT_QMAKE="${qb_install_dir}/bin" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
                echo
                echo "compiling ${app_name} ... "
                make -j"$(nproc)" >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
                echo
                echo "installing ${app_name} ... "
                make install >> "${qb_install_dir}/logs/${app_name}.log.txt" 2>&1 & spinner $!
                echo
            fi
            #
            [[ -f "${qb_install_dir}/bin/qbittorrent-nox" ]] && cp -f "${qb_install_dir}/bin/qbittorrent-nox" "${qb_install_dir}/completed/qbittorrent-nox" && echo -e "${cg}✓ qbittorrent-nox successfully built${cend}"
            #
            delete_function boost
            delete_function "${app_name}" last
        fi
    else
        application_skip last
    fi
}
#####################################################################################################################################################
# help functions
#####################################################################################################################################################
function _usagefull() {
    set_default_values
    echo -e "\nqBittorrent static build script
\nUsage: bash $(basename "$0") [modules] [OPTS]

  available modules:
  
  all | install | bison | gawk | glibc | zlib | icu | openssl | boost
  libtorrent | qtbase | qttools | qbittorrent

\nOptions:

  -b,--build-directory <path>   Setup build path for script
                                Default build location: ${cc}$(dirname "$0")/qb-build${cend}
                                ${cy}Paths are relative to the script location. 
                                I recommend that you use a full path.${cend}
                                ${td}Example:${cend}
                                ${td}${cg}${qb_working_dir_short}/$(basename -- "$0")${cend} ${td}${clm}all${cend}
                                ${td}- Will install all modules and build 
                                libtorrent to the default build location${cend}
                                ${td}Example:${cend}
                                ${td}${cg}${qb_working_dir_short}/$(basename -- "$0")${cend} ${td}${clm}all ${clb}-b${cend} ${td}${clc}\"\$HOME/build\"${cend}
                                ${td}- Will specify a build directory and 
                                install all modules to that custom location${cend}
                                ${td}Example:${cend}
                                ${td}${cg}${qb_working_dir_short}/$(basename -- "$0")${cend} ${td}${clm}module${cend}
                                ${td}- Will install a single module to the 
                                default build location${cend}
                                ${td}Example:${cend}
                                ${td}${cg}${qb_working_dir_short}/$(basename -- "$0")${cend} ${td}${clm}module${cend} ${clb}-b${cend} ${td}${clc}\"\$HOME/build\"${cend}
                                ${td}- will specify a custom build directory 
                                and install a specific modulebuse to that 
                                custom location${cend}
  --boot-strap                  Creates dirs in this structure: 
                                ${cc}${qb_install_dir_short}/patches/APPNAME/TAG/patch${cend}
                                ${td}Example:${cend}
                                ${td}${cc}${qb_install_dir_short}/patches/libtorrent/libtorrent_patch_tag/patch${cend}
                                ${td}${cc}${qb_install_dir_short}/patches/qbittorrent/qbittorrent_patch_tag/patch${cend}
  -d,--debug                    Enable debug symbols for libtorrent and 
                                qBitorrent when building
  -n,--no-delete                Skip all delete functions for selected modules
                                to leave source code directories behind.
  -o,--optimize                 Warning, using this flag will mean your static 
                                build is limited to a matching CPU
  -p,--proxy <proxy>            Specify a proxy URL and PORT to use with 
                                curl and git
                                ${td}Example:${cend}
                                ${td}${clb}-p${cend} ${td}${clc}username:password@https://123.123.1.1:8443${cend}
                                ${td}${clb}-p${cend} ${td}${clc}https://proxy.com:12345${cend}
  -v,--verbose                  Enable verbose output, otherwise compiling 
                                details will only be saved into log files.
  -i,--icu                      Use ICU libraries when building qBittorrent. 
                                Final binary size will be around ~50Mb
  -m,--master                   Always use 
                                - the master branch for ${cg}libtorrent RC_${libtorrent_version//./_}${cend}
                                - the master branch for ${cg}qBittorrent${cend}
  --lm,--libtorrent-master      Always use the master branch for 
                                ${cg}libtorrent RC_${libtorrent_version//./_}${cend}
  --qm,--qbittorrent-master     Always use the master branch for ${cg}qBittorrent${cend}
  --lt,--libtorrent-tag <tag>   Use a provided libtorrent tag when cloning 
                                from github.
                                ${td}Example with branch name:${cend}
                                ${td}${cg}${qb_working_dir_short}/$(basename -- "$0")${cend}${td}${clb} --lt ${td}${clc}RC_2_0${cend}
                                ${td}Example with release tag:${cend}
                                ${td}${cg}${qb_working_dir_short}/$(basename -- "$0")${cend}${td}${clb} --lt ${td}${clc}v1.2.11${cend}

  --qt,--qbittorrent-tag <tag>  Use a provided qBittorrent tag when cloning 
                                from github.
                                ${td}Example with branch name:${cend}
                                ${td}${cg}${qb_working_dir_short}/$(basename -- "$0")${cend}${td}${clb} --qt ${td}${clc}v4_3_x${cend}
                                ${td}Example with release tag:${cend}
                                ${td}${cg}${qb_working_dir_short}/$(basename -- "$0")${cend}${td}${clb} --qt ${td}${clc}release-4.3.0${cend}
  --pr,--patch-repo <patch>     Specify a username and repo to use patches 
                                hosted on github
                                ${td}${cg}Example:${cend}
                                ${td}${clb}--pr${cend} ${td}${clc}usnerame/repo${cend}
                                ${cy}There is a specific github directory format
                                you need to use with this flag${cend}
                                ${td}${clc}patches/libtorrent/$libtorrent_patch_tag/patch${cend}
                                ${td}${clc}patches/libtorrent/$libtorrent_patch_tag/Jamfile${cend} 
                                ${td}${clr}(defaults to branch master)${cend}
                                ${td}${clc}patches/qbittorrent/$qbittorrent_patch_tag/patch${cend}
                                ${cy}If an installation tag matches a hosted 
                                tag patch file, it will be automaticlaly used.${cend}
                                The tag name will alway be an abbreviated 
                                version of the default or specificed tag.${cend}
  --c-std <11/14/17>            Specify a C standard version for compiling
                                ${cy}now C++ Standard 17 is required by
                                qBittorrent 4.3.3 and later${cend}
  --skip-<module>               Skip rebuilding module if already exist

  -h, --help                    Display short help and exit
  --help-all,--full-help        Display this help and exit"
}

function _usage() {
    echo -e "\nqBittorrent static build script
\nUsage: bash $(basename "$0") [modules] [OPTS]

  available modules:

  all | install | bison | gawk | glibc | zlib | icu | openssl | boost
  libtorrent | qtbase | qttools | qbittorrent

\nOptions:

  -b,--build-directory <path>      Setup build path for script
                                   Default build location: ${cc}$(dirname "$0")/qb-build${cend}

  --boot-strap                     Creates dirs in this structure: 
                                   ${cc}$(dirname "$0")/qb-build/patches/APPNAME/TAG/patch${cend}

  -d,--debug                       Enables debug symbols for libtorrent and 
                                   qBitorrent when building

  -n,--no-delete                   Skip all delete functions for selected 
                                   modules to leave source code directories 
                                   behind.

  -o,--optimize                    Warning, using this flag will mean your 
                                   static build is limited to a matching CPU

  -p,--proxy <proxy>               Specify a proxy URL and PORT to use with 
                                   curl and git

  -v,--verbose                     Enable verbose output

  -i,--icu                         Use ICU libraries when building qBittorrent. 
                                   Final binary size will be around ~50Mb

  -m,--master                      Always use the master branch for
                                   libtorrent and qBittorrent

  --lm,--libtorrent-master         Always use the master branch for libtorrent

  --qm,--qbittorrent-master        Always use the master branch for qBittorrent

  --lt,--libtorrent-tag <tag>      Use a provided libtorrent tag when cloning 
                                   from github.

  --qt,--qbittorrent-tag <tag>     Use a provided qBittorrent tag when cloning 
                                   from github.

  --pr,--patch-repo <patch>        Specify a username and repo to use patches 
                                   hosted on github

  --c-std <11/14/17>               Specify a C standard version for compiling

  --skip-<module>                  Skip rebuilding module if already exist

  -h, --help                       Display this help and exit

  --help-all,--full-help           Show more details about usage"
}

function print_title() {
echo
echo "        ____  _ _   _                            _   ";
echo "       |  _ \(_) | | |                          | |  ";
echo "   __ _| |_) |_| |_| |_ ___  _ __ _ __ ___ _ __ | |_ ";
echo "  / _\` |  _ <| | __| __/ _ \| '__| '__/ _ \ '_ \| __|";
echo " | (_| | |_) | | |_| || (_) | |  | | |  __/ | | | |_ ";
echo "  \__, |____/|_|\__|\__\___/|_|  |_|  \___|_| |_|\__|";
echo "     | |                                             ";
echo "     |_|                                             ";
echo
echo "#######################################################"
echo "               qBittorrent static build"
echo "#######################################################"
echo
echo
}
#####################################################################################################################################################
# build module
#####################################################################################################################################################

#################################################################################
# OPT GENERATOR
#################################################################################
if ! ARGS=$(getopt -a -o bdnimhvpo -l boot-strap,debug,no-delete,icu,master,\
help,help-all,full-help,verbose,c-std:,lm,libtorrent-master,lt:,libtorrent-tag:,\
qm,qbittorrent-master,qt:,qbittorrent-tag:,build-directory:,proxy:,optimize,\
pr:,patch-repo:,skip-bison,skip-gawk,skip-glibc,skip-zlib,\
skip-icu,skip-openssl,skip-qtbase,skip-qttools  -- "$@")
then
    _usage
    exit 1
fi
eval set -- "${ARGS}"
while true; do
    case "$1" in
    -h | --help)
        _usage
        exit 0
        ;;
    --help-all | --full-help)
        _usagefull
        exit 0
        ;;
    -b | build-directory)
        qb_build_dir="${2}"
        shift
        ;;
    --boot-strap)
        apply_patches bootstrap
        _apply_patches
        exit 0
        ;;
    -d | --debug)
        lt_debug="debug-symbols=on"
        qb_debug="--enable-debug"
        ;;
    -n | --no-delete)
        qb_skip_delete='yes'
        ;;
    -o | --optimize)
        optimize="-march=native"
        ;;
    -p | --proxy)
        qb_git_proxy="${2}"
        qb_curl_proxy="${2}"
        shift
        ;;
    -v | --verbose)
        info_verbose='yes'
        ;;
    -i | --icu)
        qb_skip_icu='no'
        [[ "${qb_skip_icu}" = 'no' ]] && delete=("${delete[@]/icu/}")
        ;;
    -m | --master)
        libt_master_check='yes'
        qbit_master_check='yes'
        ;;
    --lm | --libtorrent-master)
        libt_master_check='yes'
        ;;
    --qm | --qbittorrent-master)
        qbit_master_check='yes'
        ;;
    --lt | --libtorrent-tag)
        libt_tag_check='yes'
        libt_tag="$2"
        shift
        ;;
    --qt | --qbittorrent-tag)
        qbit_tag_check='yes'
        qbit_tag="$2"
        shift
        ;;
    --pr | --patch-repo)
        patch_repo_check='yes'
        patch_repo="${2}"
        shift
        ;;
    --c-std)
        cstandard="$2"
        shift
        ;;
    --skip-bison)
        qb_skip_bison='yes'
        if [[ ! ${delete[*]} =~ "bison" ]]; then 
            delete+=("bison")
        fi
        ;;
    --skip-gawk)
        qb_skip_gawk='yes'
        if [[ ! ${delete[*]} =~ "gawk" ]]; then 
            delete+=("gawk")
        fi
        ;;
    --skip-glibc)
        qb_skip_glibc='yes'
        if [[ ! ${delete[*]} =~ "glibc" ]]; then 
            delete+=("glibc")
        fi
        ;;
    --skip-zlib)
        qb_skip_zlib='yes'
        if [[ ! ${delete[*]} =~ "zlib" ]]; then 
            delete+=("zlib")
        fi
        ;;
    --skip-icu)
        qb_skip_icu='yes'
        if [[ ! ${delete[*]} =~ "icu" ]]; then 
            delete+=("icu")
        fi
        ;;
    --skip-openssl)
        qb_skip_openssl='yes'
        if [[ ! ${delete[*]} =~ "openssl" ]]; then 
            delete+=("openssl")
        fi
        ;;
    --skip-qtbase)
        qb_skip_qtbase='yes'
        if [[ ! ${delete[*]} =~ "qtbase" ]]; then 
            delete+=("qtbase")
        fi
        ;;
    --skip-qttools)
        qb_skip_qttools='yes'
        if [[ ! ${delete[*]} =~ "qttools" ]]; then 
            delete+=("qttools")
        fi
        ;;
    --)
        shift
        break
        ;;
    esac
    shift
done
print_title
checkos
set_default_values "${@}"
precheck_dependencies
set_build_directory
set_module_urls
verify_repo
verify_url
check_dependencies
#####################################################################################################################################################
# Functions part 2: Use some of our functions
#####################################################################################################################################################
[[ "${*}" =~ ([[:space:]]|^)"install"([[:space:]]|$) ]] && install_qbittorrent "${@}"
#####################################################################################################################################################
# Functions part 3: Use some of our functions
#####################################################################################################################################################
check_modules
installation_modules "${@}" # see functions
_build "${@}"