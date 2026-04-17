for d in *;do r=$(if [ -e "$d/package.json" ];then cat $d/package.json|grep name|awk '{print $2}'|tr ',' ' '| tr '"' ' '|awk '/ava/ {print $1}' &2>/dev/null;fi);if [ "$r" != "" ];then echo $r;fi; done

