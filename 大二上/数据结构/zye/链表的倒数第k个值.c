#include <stdio.h>
#include <stdlib.h>


struct data {
    int num;
    struct data* link;
};

int main() {
    int i, n;
    char ch = ' ';


    struct data* temp, * head, * add;


    scanf("%d", &n);


    head = (struct data*)malloc(sizeof(struct data));
    if (head == NULL) {

        return 1;
    }


    scanf("%d", &head->num);
    head->link = NULL;

    temp = head;

    ch = getchar();


    for (i = 1; ch == ' '; ) {
        i++;

        add = (struct data*)malloc(sizeof(struct data));
        if (add == NULL) {
            return 1;
        }

        scanf("%d", &add->num);

        temp->link = add;
        temp = add;

        ch = getchar();
    }

    temp->link = NULL;


    if (n > i || n <= 0) {
        printf("Not Found");
    }
    else {

        struct data* fast = head;
        struct data* slow = head;


        for (int j = 0; j < n - 1; j++) {
            if (fast->link != NULL) {
                fast = fast->link;
            }
        }


        while (fast->link != NULL) {
            fast = fast->link;
            slow = slow->link;
        }


        printf("%d", slow->num);
    }


    struct data* current = head;
    struct data* next_node;
    while (current != NULL) {
        next_node = current->link;
        free(current);
        current = next_node;
    }

    return 0;
}