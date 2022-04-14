if (NOT ARD_VARS)
	if(NOT EXISTS "${CMAKE_CURRENT_LIST_DIR}/../../cache/arduino_cmake.txt")
		message(FATAL "cant found arduino configuration, look CCT arduino setup.")
	endif()
	file(STRINGS "${CMAKE_CURRENT_LIST_DIR}/../../cache/arduino_cmake.txt" ARD_VARS)
	list(GET ARD_VARS 0 ARDIDE)
	list(GET ARD_VARS 1 ARD_MMCU)
	list(GET ARD_VARS 2 ARD_FCPU)
	list(GET ARD_VARS 3 ARD_variant)
endif()

#inputs per line:
#ARDIDE path to ide
#ARD_MMCU
#ARD_FCPU
#ARD_variant