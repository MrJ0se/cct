if (NOT ARDUINO_TOOLCHAIN)
set (ARDUINO_TOOLCHAIN 1)

set(CMAKE_C_OUTPUT_EXTENSION .o)
set(CMAKE_C_OUTPUT_EXTENSION_REPLACE 1)
set(CMAKE_CXX_OUTPUT_EXTENSION .o)
set(CMAKE_CXX_OUTPUT_EXTENSION_REPLACE 1)

include ("${CMAKE_CURRENT_LIST_DIR}/arduino.vars.cmake")

set(ARDE_PRE "${ARDIDE}/hardware/tools/avr/bin/avr-")
set(ARDE_POS "")
if (WIN32)
	set(ARDE_POS ".exe")
endif()

set(CMAKE_SYSTEM_NAME Generic)


set(ARD_IVARIANT "${ARDIDE}/hardware/arduino/avr/variants/${ARD_variant}")
set(ARD_ICORE "${ARDIDE}/hardware/arduino/avr/cores/arduino")

set(ARD_FLAGS "-mmcu=${ARD_MMCU} -DF_CPU=${ARD_FCPU}")

set(CMAKE_ASM_COMPILER "${ARDE_PRE}as${ARDE_POS}")
set(CMAKE_C_COMPILER "${ARDE_PRE}gcc${ARDE_POS}")
set(CMAKE_CXX_COMPILER "${ARDE_PRE}g++${ARDE_POS}")

set(CMAKE_ASM_COMPILE_OBJECT "${CMAKE_ASM_COMPILER} <SOURCE> -o <OBJECT> -c <FLAGS>")
set(CMAKE_C_COMPILE_OBJECT "${CMAKE_C_COMPILER} <SOURCE> -o <OBJECT> -c <FLAGS>")
set(CMAKE_CXX_COMPILE_OBJECT "${CMAKE_CXX_COMPILER} <SOURCE> -o <OBJECT> -c <FLAGS>")

set(CMAKE_C_FLAGS  "${ARD_FLAGS}")
set(CMAKE_CXX_FLAGS  "${ARD_FLAGS}")

set(CMAKE_TRY_COMPILE_TARGET_TYPE "STATIC_LIBRARY")

set(CMAKE_EXECUTABLE_SUFFIX ".elf")
set(CMAKE_EXECUTABLE_SUFFIX_ASM ".elf")
set(CMAKE_EXECUTABLE_SUFFIX_C ".elf")
set(CMAKE_EXECUTABLE_SUFFIX_CXX ".elf")

macro(include_directories)
	foreach(item ${ARGV})
		set(CMAKE_C_FLAGS     "${CMAKE_C_FLAGS} -I${item}")
		set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -I${item}")
	endforeach()
endmacro()
macro(target_include_directories proj)
	set (TSTAT PRIVATE)
	foreach(item ${ARGV} RANGE 1 9999)
		if("PUBLIC" STREQUAL "${item}")
			set (TSTAT PUBLIC)
		elseif("PRIVATE" STREQUAL "${item}")
		else()
			target_compile_options(${proj} ${TSTAT} -I${item})
		endif()
	endforeach()
endmacro()



file(GLOB_RECURSE ARDCORE_SRC
	"${ARD_IVARIANT}/*.s"
	"${ARD_IVARIANT}/*.S"
	"${ARD_IVARIANT}/*.c"
	"${ARD_IVARIANT}/*.cc"
	"${ARD_IVARIANT}/*.cpp"
	"${ARD_IVARIANT}/*.cx"
	"${ARD_IVARIANT}/*.cxx"
	"${ARD_ICORE}/*.s"
	"${ARD_ICORE}/*.S"
	"${ARD_ICORE}/*.c"
	"${ARD_ICORE}/*.cc"
	"${ARD_ICORE}/*.cpp"
	"${ARD_ICORE}/*.cx"
	"${ARD_ICORE}/*.cxx"
	"${ARD_ICORE}/*.s"
	"${ARD_ICORE}/*.S"
)
list(FILTER ARDCORE_SRC EXCLUDE REGEX "main.cpp$") 

add_library(arduinocore STATIC ${ARDCORE_SRC})
target_include_directories(arduinocore PUBLIC ${ARD_IVARIANT} ${ARD_ICORE})

macro(USE_ARDU_LIB proj library)
	set(ext_lib_inc "${ARDIDE}/hardware/arduino/avr/libraries/${library}/src")
	set(ext_lib arduino_${library})

	target_include_directories(${proj} ${ext_lib_inc})
	if (${ext_lib}_IMPORTED)
		target_include_directories(${proj} ${ext_lib})
	else()
		file(GLOB_RECURSE ext_lib_src
			"${ext_lib_inc}/*.c"
			"${ext_lib_inc}/*.cc"
			"${ext_lib_inc}/*.cpp"
			"${ext_lib_inc}/*.cx"
			"${ext_lib_inc}/*.cxx"
		)
		if (ext_lib_src)
			set(${ext_lib}_IMPORTED)
			add_library(${ext_lib} ${ext_lib_src})
			target_include_directories(${proj} ${ext_lib})
		endif()
	endif()
endmacro()

endif()