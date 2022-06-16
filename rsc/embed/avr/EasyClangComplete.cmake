if (NOT AVR_ECC)
set (AVR_ECC 1)

include ("${CMAKE_CURRENT_LIST_DIR}/../vars.cmake")

if(NOT CCT_TARGET)
	add_definitions(-DUSBCON -DUBRR1H -DUBRR2H -DUBRR3H)
	include_directories(
	#AVR chip basic
		"${ARDIDE_TOOL}/avr/include"
	)

	set(ARD_IVARIANT "${ARDIDE_ARD}/variants/${ARD_variant}")
	set(ARD_ICORE "${ARDIDE_ARD}/cores/arduino")
	add_library(arduinocore INTERFACE)
	target_include_directories(arduinocore INTERFACE ${ARD_IVARIANT} ${ARD_ICORE})

	macro(USE_ARDU_LIB proj library)
		set(ext_lib_inc "${ARDIDE_ARD}/libraries/${library}/src")
		target_include_directories(${proj} PUBLIC ${ext_lib_inc})
	endmacro()
endif()

endif()