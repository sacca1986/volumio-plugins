
#!/bin/sh

CallBash=$1
command=$2
PreState=$(cat /data/plugins/miscellanea/autostandbyamp/scripts/VpreState)

#echo $PreState


VStatus=$(volumio status | awk 'NR==2{ gsub("\"",""); gsub(",","");print $2 }')

if [ $CallBash = "start" ]; then

        if [ $VStatus = "play" ] && [ $PreState = "stop" ]; then
                VStatus2=$(volumio status | awk 'NR==2{ gsub("\"",""); gsub(",","");print $2 }')
                if [ $VStatus = "play" ] && [ $VStatus2 = "play" ] && [ $PreState = "stop" ]; then
                        echo "send command start"
			$command
			#irsend SEND_ONCE AUNA-amp KEY_POWER
			echo "start" > /data/plugins/miscellanea/autostandbyamp/scripts/VpreState
                fi
        fi
fi




if [ $CallBash = "stop" ]; then

	if [ $VStatus = "stop" ] && [ $PreState = "start" ]; then
		sleep 2
		VStatus2=$(volumio status | awk 'NR==2{ gsub("\"",""); gsub(",","");print $2 }')
		if [ $VStatus = "stop" ] && [ $VStatus2 = "stop" ] && [ $PreState = "start" ]; then
		echo "send command stop"
		$command
		#irsend SEND_ONCE AUNA-amp KEY_POWER
		echo "stop" > /data/plugins/miscellanea/autostandbyamp/scripts/VpreState
		fi
	fi

        if [ $VStatus = "pause" ] && [ $PreState = "start" ]; then
                sleep 2
                VStatus2=$(volumio status | awk 'NR==2{ gsub("\"",""); gsub(",","");print $2 }')
                if [ $VStatus = "pause" ] && [ $VStatus2 = "pause" ] && [ $PreState = "start" ]; then
                echo "send command stop"
                $command
		#irsend SEND_ONCE AUNA-amp KEY_POWER
                echo "stop" > /data/plugins/miscellanea/autostandbyamp/scripts/VpreState
                fi
        fi


fi
